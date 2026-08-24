import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { assignEquipmentToUser } from "@/lib/equipment/assign-to-user";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const canAssign = (await isAdmin(userId)) || (await hasModuleAccess(userId, "equipment", "write"));
  if (!canAssign) {
    return NextResponse.json({ error: "Nemáte oprávnění přiřazovat vybavení" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const targetUser = parseInt(String(body.user_id ?? ""), 10);
  const notes = body.notes ? String(body.notes) : null;
  const ids: number[] = Array.isArray(body.equipment_ids)
    ? body.equipment_ids.map((x: unknown) => parseInt(String(x), 10)).filter((n: number) => Number.isFinite(n))
    : [];

  if (!Number.isFinite(targetUser) || targetUser <= 0) {
    return NextResponse.json({ error: "Vyberte uživatele" }, { status: 400 });
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: "Vyberte položky" }, { status: 400 });
  }

  const targetUserExists = await prisma.users.findFirst({
    where: { id: targetUser, is_active: true },
    select: { id: true },
  });
  if (!targetUserExists) {
    return NextResponse.json({ error: "Uživatel nenalezen nebo není aktivní" }, { status: 400 });
  }

  const assigned: number[] = [];
  const errors: string[] = [];
  for (const equipmentId of ids) {
    try {
      const r = await assignEquipmentToUser({
        equipmentId,
        targetUserId: targetUser,
        assignedBy: userId,
        notes,
      });
      assigned.push(r.assignmentId);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `Položka #${equipmentId}`);
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    assigned: assigned.length,
    errors,
  });
}
