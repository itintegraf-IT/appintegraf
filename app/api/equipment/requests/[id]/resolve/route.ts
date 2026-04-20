import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { sendEquipmentRequestResultEmail } from "@/lib/email";

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

/** PATCH – IT označí schválený požadavek jako vyřízený (technika dodána/předána) */
export async function PATCH(
  _req: NextRequest,
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
    return NextResponse.json(
      { error: "Vyřídit mohou pouze uživatelé z oddělení IT" },
      { status: 403 }
    );
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.equipment_requests.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Požadavek nenalezen" }, { status: 404 });
  }
  if (existing.status !== "schv_leno") {
    return NextResponse.json(
      { error: "Vyřídit lze pouze schválený požadavek" },
      { status: 400 }
    );
  }

  await prisma.equipment_requests.update({
    where: { id },
    data: {
      status: "vy__zeno",
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
        result: "resolved",
        itResponse: existing.it_response,
        adminResponse: existing.admin_response,
      });
    } catch (e) {
      console.error("resolve email send failed:", e);
    }
  }

  return NextResponse.json({ success: true });
}
