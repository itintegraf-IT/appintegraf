import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { sendEquipmentRequestResultEmail } from "@/lib/email";
import { dismissNotificationsForLink } from "@/lib/notifications-dismiss";

async function isInDepartment(userId: number, departmentName: string): Promise<boolean> {
  const dept = await prisma.departments.findFirst({
    where: { name: departmentName, is_active: true },
  });
  if (!dept) return false;
  const inMain = await prisma.users.findFirst({
    where: { id: userId, department_id: dept.id },
  });
  if (inMain) return true;
  const inSecondary = await prisma.user_secondary_departments.findFirst({
    where: { user_id: userId, department_id: dept.id },
  });
  return !!inSecondary;
}

/** PATCH – Vedení schválí nebo zamítne požadavek */
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
  const [inIT, inVedeni] = await Promise.all([
    isInDepartment(userId, "IT"),
    isInDepartment(userId, "Vedení"),
  ]);
  if (!admin && !inIT && !inVedeni) {
    return NextResponse.json(
      { error: "Schvalovat mohou pouze uživatelé z oddělení IT nebo Vedení" },
      { status: 403 }
    );
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { action, admin_response } = body;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Neplatná akce (approve/reject)" }, { status: 400 });
  }

  const existing = await prisma.equipment_requests.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Požadavek nenalezen" }, { status: 404 });
  }

  // IT / admin smí rozhodnout přímo ve stavu "nov_" (bez předání vedení),
  // Vedení rozhoduje ve stavu "cek_na_schv_len_" pouze pokud je jim požadavek přidělen.
  if (existing.status === "nov_") {
    if (!admin && !inIT) {
      return NextResponse.json(
        { error: "Přímé schválení ve stavu „Nový“ mohou provést jen IT / admin" },
        { status: 403 }
      );
    }
  } else if (existing.status === "cek_na_schv_len_") {
    if (!admin && existing.approval_requested_to !== userId) {
      return NextResponse.json(
        { error: "Tento požadavek vám nebyl určen ke schválení" },
        { status: 403 }
      );
    }
  } else {
    return NextResponse.json({ error: "Požadavek již byl zpracován" }, { status: 400 });
  }

  const newStatus = action === "approve" ? "schv_leno" : "zam_tnuto";
  const adminResponseText = admin_response ? String(admin_response).trim() : null;
  const equipmentLink = `/equipment?tab=requests&id=${id}`;

  await dismissNotificationsForLink(equipmentLink);

  await prisma.equipment_requests.update({
    where: { id },
    data: {
      status: newStatus,
      admin_response: adminResponseText,
      processed_by: userId,
      processed_at: new Date(),
      updated_at: new Date(),
    },
  });

  if (existing.requester_email) {
    try {
      await sendEquipmentRequestResultEmail({
        toEmail: existing.requester_email,
        toName: existing.requester_name ?? "uživateli",
        requestId: id,
        equipmentType: existing.equipment_type ?? "",
        result: action === "approve" ? "approved" : "rejected",
        itResponse: existing.it_response,
        adminResponse: adminResponseText,
      });
    } catch (e) {
      console.error("approve email send failed:", e);
    }
  }

  return NextResponse.json({ success: true });
}
