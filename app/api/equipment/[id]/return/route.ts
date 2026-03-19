import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";

/** POST – vrácení vybavení (ukončení přiřazení) */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);

  const equipmentId = parseInt((await params).id, 10);
  if (isNaN(equipmentId)) {
    return NextResponse.json({ error: "Neplatné ID vybavení" }, { status: 400 });
  }

  const assignment = await prisma.equipment_assignments.findFirst({
    where: { equipment_id: equipmentId, returned_at: null },
  });

  if (!assignment) {
    return NextResponse.json({ error: "Vybavení není přiřazeno žádnému uživateli" }, { status: 400 });
  }

  const isAssignedUser = assignment.user_id === userId;
  const canReturn = isAssignedUser || (await isAdmin(userId)) || (await hasModuleAccess(userId, "equipment", "write"));
  if (!canReturn) {
    return NextResponse.json({ error: "Nemáte oprávnění vracet toto vybavení" }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.equipment_assignments.update({
      where: { id: assignment.id },
      data: { returned_at: new Date() },
    }),
    prisma.equipment_items.update({
      where: { id: equipmentId },
      data: { status: "skladem", updated_at: new Date() },
    }),
  ]);

  return NextResponse.json({ success: true });
}
