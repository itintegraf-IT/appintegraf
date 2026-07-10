import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { isInDepartment } from "@/lib/equipment-departments";
import {
  validateVedeniApprover,
  workflowLogInclude,
} from "@/lib/equipment-request-approver";
import { dismissNotificationsForLink } from "@/lib/notifications-dismiss";

/** GET – detail požadavku */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "equipment", "read"))) {
    return NextResponse.json({ error: "Nemáte přístup" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const request = await prisma.equipment_requests.findUnique({
    where: { id },
    include: {
      users_it: { select: { id: true, first_name: true, last_name: true } },
      users_approval: { select: { id: true, first_name: true, last_name: true } },
      workflow_log: workflowLogInclude,
    },
  });

  if (!request) {
    return NextResponse.json({ error: "Požadavek nenalezen" }, { status: 404 });
  }

  return NextResponse.json({ request });
}

/** PATCH – IT přidá stanovisko a odešle vedení ke schválení */
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
  if (!inIT) {
    return NextResponse.json({ error: "Stanovisko mohou dávat pouze uživatelé z oddělení IT" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { it_response, approval_requested_to } = body;

  const approvalTo = approval_requested_to != null ? parseInt(String(approval_requested_to), 10) : null;
  if (!approvalTo || isNaN(approvalTo)) {
    return NextResponse.json({ error: "Vyberte příjemce ke schválení" }, { status: 400 });
  }

  const validationError = await validateVedeniApprover(approvalTo);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const existing = await prisma.equipment_requests.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Požadavek nenalezen" }, { status: 404 });
  }
  if (existing.status !== "nov_") {
    return NextResponse.json({ error: "Požadavek již byl zpracován" }, { status: 400 });
  }

  const hasExistingItResponse = !!existing.it_response?.trim();
  const newItResponse = it_response != null ? String(it_response).trim() : "";

  if (!hasExistingItResponse) {
    if (!newItResponse) {
      return NextResponse.json({ error: "Vyplňte stanovisko" }, { status: 400 });
    }
  }

  const finalItResponse = newItResponse || existing.it_response?.trim() || "";
  if (!finalItResponse) {
    return NextResponse.json({ error: "Vyplňte stanovisko" }, { status: 400 });
  }

  const equipmentLink = `/equipment?tab=requests&id=${id}`;

  await prisma.equipment_requests.update({
    where: { id },
    data: {
      it_response: finalItResponse,
      it_response_by: userId,
      it_response_at: new Date(),
      approval_requested_to: approvalTo,
      approval_requested_at: new Date(),
      status: "cek_na_schv_len_",
      updated_at: new Date(),
    },
  });

  await dismissNotificationsForLink(equipmentLink);

  await prisma.notifications.create({
    data: {
      user_id: approvalTo,
      title: "Požadavek na techniku čeká na schválení",
      message: `IT odeslal požadavek #${id} ke schválení.`,
      type: "equipment_approval",
      link: equipmentLink,
    },
  });

  return NextResponse.json({ success: true });
}
