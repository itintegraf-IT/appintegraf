import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";

/** GET – seznam uživatelů pro přiřazení vybavení (dropdown) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const canAssign = (await isAdmin(userId)) || (await hasModuleAccess(userId, "equipment", "write"));
  if (!canAssign) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const users = await prisma.users.findMany({
    where: { is_active: true },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    take: 500,
    select: { id: true, first_name: true, last_name: true },
  });

  return NextResponse.json(users);
}
