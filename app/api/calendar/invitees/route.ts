import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

/**
 * Seznam uživatelů pro pozvánky k událostem (aktivní účty).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "calendar", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const users = await prisma.users.findMany({
    where: { is_active: true, id: { not: userId } },
    select: { id: true, first_name: true, last_name: true },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    take: 2000,
  });

  return NextResponse.json({ users });
}
