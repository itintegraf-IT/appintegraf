import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import {
  getGrafikaTransitionRoles,
  resolveGrafikaTransitionAccess,
  userCanOverrideGrafikaTransitions,
  userCanViewMaketa,
} from "@/lib/makety-access";
import {
  assertGrafikaTransition,
  grafikaActingAsLabel,
  grafikaTransitionActionLabel,
  grafikaTransitionRequiresComment,
  listGrafikaTransitionOptions,
  parseGrafikaStatus,
  type GrafikaStatus,
} from "@/lib/makety-grafika-status";
import { sendMaketyClientPlainEmail } from "@/lib/email";
import { notifyMaketaDone, notifyMaketaUsers } from "@/lib/makety-notify";
import { recordMaketyFileEvent } from "@/lib/makety-file-events";
import { maketaStatusLabel } from "@/lib/makety-status";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }
  if (!(await userCanViewMaketa(userId, id))) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  const maketa = await prisma.makety.findUnique({
    where: { id },
    select: { status: true, work_type: true },
  });
  if (!maketa || maketa.work_type !== "grafika") {
    return NextResponse.json({ transitions: [] });
  }

  const roles = await getGrafikaTransitionRoles(userId, id);
  const canOverride = await userCanOverrideGrafikaTransitions(userId, id);
  const options = listGrafikaTransitionOptions(maketa.status, roles, canOverride);

  return NextResponse.json({
    currentStatus: maketa.status,
    transitions: options.map((o) => ({
      toStatus: o.toStatus,
      label: o.viaOverride
        ? `${grafikaTransitionActionLabel(o.toStatus, maketa.status)} (převzetí: ${grafikaActingAsLabel(o.actingAs)})`
        : grafikaTransitionActionLabel(o.toStatus, maketa.status),
      requiresComment: grafikaTransitionRequiresComment(maketa.status, o.toStatus),
      requiresOverrideAck: o.viaOverride,
      actingAs: o.actingAs,
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  let body: { toStatus?: string; comment?: string; acknowledgeOverride?: boolean; emailClient?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  const toStatus = parseGrafikaStatus(String(body.toStatus ?? ""));
  if (!toStatus) {
    return NextResponse.json({ error: "Neplatný cílový stav" }, { status: 400 });
  }

  const access = await resolveGrafikaTransitionAccess(
    userId,
    id,
    toStatus,
    body.acknowledgeOverride === true
  );
  if (!access.ok) {
    return NextResponse.json(
      {
        error: access.error,
        needsOverrideAck: access.needsOverrideAck === true,
      },
      { status: access.needsOverrideAck ? 400 : 403 }
    );
  }

  const maketa = await prisma.makety.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      work_type: true,
      body: true,
      order_number: true,
      created_by: true,
      assignee_user_id: true,
      prepress_user_id: true,
      final_approver_user_id: true,
      customer_id: true,
    },
  });
  if (!maketa || maketa.work_type !== "grafika") {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  let comment = (body.comment ?? "").trim();
  if (access.viaOverride) {
    const note = `Převzetí role (${grafikaActingAsLabel(access.actingAs)}) – potvrzeno.`;
    comment = comment ? `${comment}\n${note}` : note;
  }

  try {
    assertGrafikaTransition({
      fromStatus: maketa.status,
      toStatus,
      comment,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Neplatný přechod" },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.makety.update({
      where: { id },
      data: { status: toStatus },
    });

    await tx.makety_status_log.create({
      data: {
        maketa_id: id,
        from_status: maketa.status,
        to_status: toStatus,
        user_id: userId,
        comment: comment || null,
      },
    });

    if (comment) {
      await tx.makety_comments.create({
        data: {
          maketa_id: id,
          user_id: userId,
          body: comment,
        },
      });
    }

    await recordMaketyFileEvent({
      tx,
      maketaId: id,
      eventType: "workflow_transition",
      userId,
      meta: {
        from_status: maketa.status,
        to_status: toStatus,
        from_label: maketaStatusLabel(maketa.status, "grafika"),
        to_label: maketaStatusLabel(toStatus, "grafika"),
        comment: comment || null,
      },
    });
  });

  await notifyAfterGrafikaTransition({
    maketaId: id,
    fromStatus: maketa.status,
    toStatus,
    actorUserId: userId,
    bodyPreview: comment || maketa.body,
    orderNumber: maketa.order_number,
    createdBy: maketa.created_by,
    assigneeUserId: maketa.assignee_user_id,
    prepressUserId: maketa.prepress_user_id,
    finalApproverUserId: maketa.final_approver_user_id,
  });

  if (toStatus === "data_problem" && body.emailClient === true && comment) {
    const customer = maketa.customer_id
      ? await prisma.iml_customers.findUnique({
          where: { id: maketa.customer_id },
          select: {
            email: true,
            name: true,
            iml_customer_emails: {
              where: { is_primary: true },
              take: 1,
              select: { email: true },
            },
          },
        })
      : null;
    const toEmail =
      customer?.email?.trim() || customer?.iml_customer_emails[0]?.email?.trim() || "";
    if (toEmail) {
      const sent = await sendMaketyClientPlainEmail({
        toEmail,
        subject: `Grafika #${id} – pozastaveno (chybí data)`,
        text: `Dobrý den,\n\nzakázka grafiky #${id}${maketa.order_number ? ` (${maketa.order_number})` : ""} je pozastavená z důvodu problému s daty.\n\n${comment}\n\nINTEGRAF`,
      });
      if (!sent.success) {
        return NextResponse.json({
          success: true,
          status: toStatus,
          viaOverride: access.viaOverride,
          warning: sent.error ?? "Stav uložen, e-mail klientovi se nepodařilo odeslat",
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    status: toStatus,
    viaOverride: access.viaOverride,
  });
}

async function notifyAfterGrafikaTransition(params: {
  maketaId: number;
  fromStatus: string;
  toStatus: GrafikaStatus;
  actorUserId: number;
  bodyPreview: string;
  orderNumber: string | null;
  createdBy: number;
  assigneeUserId: number | null;
  prepressUserId: number | null;
  finalApproverUserId: number | null;
}): Promise<void> {
  const {
    maketaId,
    fromStatus,
    toStatus,
    actorUserId,
    bodyPreview,
    orderNumber,
    createdBy,
    assigneeUserId,
    prepressUserId,
    finalApproverUserId,
  } = params;

  if (toStatus === "done") {
    await notifyMaketaDone({
      maketaId,
      doneByUserId: actorUserId,
      creatorUserId: createdBy,
      bodyPreview,
      orderNumber,
      workType: "grafika",
      prepressUserId,
    });
    return;
  }

  if (toStatus === "data_problem") {
    await notifyMaketaUsers({
      maketaId,
      userIds: [createdBy],
      bodyPreview,
      orderNumber,
      kind: "data_problem",
      workType: "grafika",
      excludeUserId: actorUserId,
    });
    return;
  }

  if (toStatus === "in_progress" && fromStatus === "done") {
    await notifyMaketaUsers({
      maketaId,
      userIds: [assigneeUserId, createdBy],
      bodyPreview,
      orderNumber,
      kind: "returned_to_dtp",
      workType: "grafika",
      excludeUserId: actorUserId,
    });
    return;
  }

  if (toStatus === "prepress_approved") {
    if (finalApproverUserId != null && finalApproverUserId !== createdBy) {
      await notifyMaketaUsers({
        maketaId,
        userIds: [finalApproverUserId],
        bodyPreview,
        orderNumber,
        kind: "awaiting_final",
        workType: "grafika",
        excludeUserId: actorUserId,
      });
    }
    await notifyMaketaUsers({
      maketaId,
      userIds: [createdBy],
      bodyPreview,
      orderNumber,
      kind: "prepress_ok",
      workType: "grafika",
      excludeUserId: actorUserId,
    });
    return;
  }

  if (toStatus === "sent_for_approval") {
    return;
  }

  if (toStatus === "approved") {
    return;
  }
}
