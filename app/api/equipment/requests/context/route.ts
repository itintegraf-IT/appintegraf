import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { getDepartmentMembers, isInDepartment } from "@/lib/equipment-departments";

/**
 * GET – Kontext pro UI rychlých akcí na kartě požadavku.
 * Vrací: userId, isAdmin, canWrite, inIT (nebo admin), vedeniMembers.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const [admin, canWrite, realInIT, vedeniMembers] = await Promise.all([
    isAdmin(userId),
    hasModuleAccess(userId, "equipment", "write"),
    isInDepartment(userId, "IT"),
    getDepartmentMembers("Vedení"),
  ]);

  return NextResponse.json({
    userId,
    isAdmin: admin,
    canWrite,
    inIT: realInIT || admin,
    vedeniMembers,
  });
}
