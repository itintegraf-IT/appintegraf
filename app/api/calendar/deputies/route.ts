import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/calendar/deputies
 * Vrací seznam uživatelů, kteří mohou zastupovat přihlášeného uživatele.
 * Jsou to uživatelé ze stejného hlavního oddělení a obou sekundárních oddělení.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      department_id: true,
      user_secondary_departments: { select: { department_id: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ deputies: [] });
  }

  const departmentIds: number[] = [];
  if (user.department_id) {
    departmentIds.push(user.department_id);
  }
  for (const sec of user.user_secondary_departments) {
    if (!departmentIds.includes(sec.department_id)) {
      departmentIds.push(sec.department_id);
    }
  }

  if (departmentIds.length === 0) {
    return NextResponse.json({ deputies: [] });
  }

  const deputies = await prisma.users.findMany({
    where: {
      id: { not: userId },
      is_active: true,
      OR: [
        { department_id: { in: departmentIds } },
        {
          user_secondary_departments: {
            some: { department_id: { in: departmentIds } },
          },
        },
      ],
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
    },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
  });

  return NextResponse.json({ deputies });
}
