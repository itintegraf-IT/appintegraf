import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { isInDepartment } from "@/lib/equipment-departments";
import {
  getEquipmentITNotifyUserIds,
  validateVedeniApprover,
} from "@/lib/equipment-request-approver";
import { dismissNotificationsForLink } from "@/lib/notifications-dismiss";

/** PATCH – přeřazení schvalovatele nebo vrácení požadavku IT */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "equipment", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const admin = await isAdmin(userId);
  const inIT = admin || (await isInDepartment(userId, "IT"));

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { action, approval_requested_to, comment } = body;

  if (action !== "reassign" && action !== "return_to_it") {
    return NextResponse.json(
      { error: "Neplatná akce (reassign/return_to_it)" },
      { status: 400 }
    );
  }

  const existing = await prisma.equipment_requests.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Požadavek nenalezen" }, { status: 404 });
  }
  if (existing.status !== "cek_na_schv_len_") {
    return NextResponse.json(
      { error: "Přesměrování je možné pouze u požadavků čekajících na schválení" },
      { status: 400 }
    );
  }

  const isCurrentApprover = existing.approval_requested_to === userId;
  const equipmentLink = `/equipment?tab=requests&id=${id}`;

  if (action === "reassign") {
    if (!admin && !inIT && !isCurrentApprover) {
      return NextResponse.json(
        { error: "Přeřadit smí pouze IT, admin nebo aktuální schvalovatel" },
        { status: 403 }
      );
    }

    const approvalTo = approval_requested_to != null
      ? parseInt(String(approval_requested_to), 10)
      : null;
    if (!approvalTo || isNaN(approvalTo)) {
      return NextResponse.json({ error: "Vyberte nového schvalovatele" }, { status: 400 });
    }

    if (approvalTo === existing.approval_requested_to) {
      return NextResponse.json(
        { error: "Požadavek je již přiřazen tomuto schvalovateli" },
        { status: 400 }
      );
    }

    const validationError = await validateVedeniApprover(approvalTo);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const commentText = comment ? String(comment).trim() : null;

    await prisma.$transaction([
      prisma.equipment_requests.update({
        where: { id },
        data: {
          approval_requested_to: approvalTo,
          approval_requested_at: new Date(),
          updated_at: new Date(),
        },
      }),
      prisma.equipment_request_workflow_log.create({
        data: {
          request_id: id,
          action: "reassign",
          actor_user_id: userId,
          from_user_id: existing.approval_requested_to,
          to_user_id: approvalTo,
          comment: commentText,
        },
      }),
    ]);

    await dismissNotificationsForLink(equipmentLink);

    await prisma.notifications.create({
      data: {
        user_id: approvalTo,
        title: "Požadavek na techniku čeká na schválení",
        message: `Požadavek #${id} vám byl přeřazen ke schválení.`,
        type: "equipment_approval",
        link: equipmentLink,
      },
    });

    return NextResponse.json({ success: true });
  }

  // return_to_it
  if (!admin && !isCurrentApprover) {
    return NextResponse.json(
      { error: "Vrátit IT smí pouze admin nebo aktuální schvalovatel" },
      { status: 403 }
    );
  }

  const commentText = comment ? String(comment).trim() : "";
  if (!commentText) {
    return NextResponse.json(
      { error: "Vyplňte důvod / pokyn pro IT" },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.equipment_requests.update({
      where: { id },
      data: {
        status: "nov_",
        approval_requested_to: null,
        approval_requested_at: null,
        updated_at: new Date(),
      },
    }),
    prisma.equipment_request_workflow_log.create({
      data: {
        request_id: id,
        action: "return_to_it",
        actor_user_id: userId,
        from_user_id: existing.approval_requested_to,
        to_user_id: null,
        comment: commentText,
      },
    }),
  ]);

  await dismissNotificationsForLink(equipmentLink);

  const notifyUserIds = await getEquipmentITNotifyUserIds(existing.it_response_by);
  if (notifyUserIds.length > 0) {
    await prisma.notifications.createMany({
      data: notifyUserIds.map((uid) => ({
        user_id: uid,
        title: "Požadavek na techniku vrácen IT",
        message: `Schvalovatel vrátil požadavek #${id} k přeřazení schvalovatele.`,
        type: "equipment_request",
        link: equipmentLink,
      })),
    });
  }

  return NextResponse.json({ success: true });
}
