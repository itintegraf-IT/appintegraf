import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import {
  getGrafikaTransitionRoles,
  userCanTransitionGrafika,
  userCanViewMaketa,
} from "@/lib/makety-access";
import {
  assertGrafikaTransition,
  getAllowedGrafikaTransitions,
  grafikaTransitionActionLabel,
  parseGrafikaStatus,
  type GrafikaStatus,
} from "@/lib/makety-grafika-status";
import {
  notifyMaketaDone,
  notifyMaketaUsers,
} from "@/lib/makety-notify";

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
  const allowed = getAllowedGrafikaTransitions(maketa.status, roles);

  return NextResponse.json({
    currentStatus: maketa.status,
    transitions: allowed.map((to) => ({
      toStatus: to,
      label: grafikaTransitionActionLabel(to, maketa.status),
      requiresComment: to === "data_problem",
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

  let body: { toStatus?: string; comment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  const toStatus = parseGrafikaStatus(String(body.toStatus ?? ""));
  if (!toStatus) {
    return NextResponse.json({ error: "Neplatný cílový stav" }, { status: 400 });
  }

  if (!(await userCanTransitionGrafika(userId, id, toStatus))) {
    return NextResponse.json({ error: "Nemáte oprávnění k tomuto přechodu" }, { status: 403 });
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
    },
  });
  if (!maketa || maketa.work_type !== "grafika") {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  const comment = (body.comment ?? "").trim();
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
  });

  await notifyAfterGrafikaTransition({
    maketaId: id,
    toStatus,
    actorUserId: userId,
    bodyPreview: comment || maketa.body,
    orderNumber: maketa.order_number,
    createdBy: maketa.created_by,
    assigneeUserId: maketa.assignee_user_id,
    prepressUserId: maketa.prepress_user_id,
    finalApproverUserId: maketa.final_approver_user_id,
  });

  return NextResponse.json({ success: true, status: toStatus });
}

async function notifyAfterGrafikaTransition(params: {
  maketaId: number;
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

  if (toStatus === "prepress_approved") {
    await notifyMaketaUsers({
      maketaId,
      userIds: [finalApproverUserId],
      bodyPreview,
      orderNumber,
      kind: "awaiting_final",
      workType: "grafika",
      excludeUserId: actorUserId,
    });
    await notifyMaketaUsers({
      maketaId,
      userIds: [createdBy, assigneeUserId],
      bodyPreview,
      orderNumber,
      kind: "prepress_ok",
      workType: "grafika",
      excludeUserId: actorUserId,
    });
    return;
  }

  if (toStatus === "sent_for_approval") {
    await notifyMaketaUsers({
      maketaId,
      userIds: [createdBy, assigneeUserId, prepressUserId],
      bodyPreview,
      orderNumber,
      kind: "sent_for_client",
      workType: "grafika",
      excludeUserId: actorUserId,
    });
    return;
  }

  if (toStatus === "approved") {
    await notifyMaketaUsers({
      maketaId,
      userIds: [createdBy, assigneeUserId, prepressUserId],
      bodyPreview,
      orderNumber,
      kind: "approved",
      workType: "grafika",
      excludeUserId: actorUserId,
    });
  }
}
