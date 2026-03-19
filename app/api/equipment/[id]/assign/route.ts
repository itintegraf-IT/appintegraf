import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";

/** POST – přiřazení vybavení uživateli */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const canAssign = (await isAdmin(userId)) || (await hasModuleAccess(userId, "equipment", "write"));
  if (!canAssign) {
    return NextResponse.json({ error: "Nemáte oprávnění přiřazovat vybavení" }, { status: 403 });
  }

  const equipmentId = parseInt((await params).id, 10);
  if (isNaN(equipmentId)) {
    return NextResponse.json({ error: "Neplatné ID vybavení" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { user_id: targetUserId, notes } = body;

  const targetUser = targetUserId != null ? parseInt(String(targetUserId), 10) : null;
  if (!targetUser || isNaN(targetUser)) {
    return NextResponse.json({ error: "Vyberte uživatele" }, { status: 400 });
  }

  const item = await prisma.equipment_items.findUnique({
    where: { id: equipmentId },
    include: {
      equipment_assignments: {
        where: { returned_at: null },
        take: 1,
      },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Vybavení nenalezeno" }, { status: 404 });
  }

  if (item.status === "vy_azeno") {
    return NextResponse.json({ error: "Vyřazené vybavení nelze přiřadit" }, { status: 400 });
  }

  if (item.status !== "skladem") {
    return NextResponse.json({ error: "K přiřazení je dostupné pouze vybavení se statusem Skladem" }, { status: 400 });
  }

  if (item.equipment_assignments.length > 0) {
    return NextResponse.json({ error: "Vybavení je již přiřazeno jinému uživateli" }, { status: 400 });
  }

  const targetUserExists = await prisma.users.findFirst({
    where: { id: targetUser, is_active: true },
  });
  if (!targetUserExists) {
    return NextResponse.json({ error: "Uživatel nenalezen nebo není aktivní" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.equipment_assignments.create({
      data: {
        equipment_id: equipmentId,
        user_id: targetUser,
        assigned_by: userId,
        notes: notes ? String(notes).trim() : null,
      },
    }),
    prisma.equipment_items.update({
      where: { id: equipmentId },
      data: { status: "p_i_azeno", updated_at: new Date() },
    }),
  ]);

  return NextResponse.json({ success: true });
}
