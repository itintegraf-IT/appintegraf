import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** GET ?name=IT – zkontroluje, zda je přihlášený uživatel v oddělení */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "Chybí parametr name" }, { status: 400 });
  }

  const dept = await prisma.departments.findFirst({
    where: { name, is_active: true },
  });
  if (!dept) {
    return NextResponse.json({ inDepartment: false });
  }

  const inMain = await prisma.users.findFirst({
    where: { id: userId, department_id: dept.id },
  });
  if (inMain) {
    return NextResponse.json({ inDepartment: true });
  }

  const inSecondary = await prisma.user_secondary_departments.findFirst({
    where: { user_id: userId, department_id: dept.id },
  });

  return NextResponse.json({ inDepartment: !!inSecondary });
}
