import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

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

  const inVedeni = await isInDepartment(userId, "Vedení");
  if (!inVedeni) {
    return NextResponse.json({ error: "Schvalovat mohou pouze uživatelé z oddělení Vedení" }, { status: 403 });
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
  if (existing.status !== "cek_na_schv_len_") {
    return NextResponse.json({ error: "Požadavek nečeká na schválení" }, { status: 400 });
  }
  if (existing.approval_requested_to !== userId) {
    return NextResponse.json({ error: "Tento požadavek vám nebyl určen ke schválení" }, { status: 403 });
  }

  const newStatus = action === "approve" ? "schv_leno" : "zam_tnuto";

  await prisma.equipment_requests.update({
    where: { id },
    data: {
      status: newStatus,
      admin_response: admin_response ? String(admin_response).trim() : null,
      processed_by: userId,
      processed_at: new Date(),
      updated_at: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
