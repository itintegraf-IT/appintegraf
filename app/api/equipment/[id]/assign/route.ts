import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { assignEquipmentToUser } from "@/lib/equipment/assign-to-user";
import { parseNotifyFlag } from "@/lib/equipment/parse-notify-flag";

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
  const notify = parseNotifyFlag(body.notify);

  const targetUser = targetUserId != null ? parseInt(String(targetUserId), 10) : null;
  if (!targetUser || isNaN(targetUser)) {
    return NextResponse.json({ error: "Vyberte uživatele" }, { status: 400 });
  }

  const targetUserExists = await prisma.users.findFirst({
    where: { id: targetUser, is_active: true },
    select: { id: true },
  });
  if (!targetUserExists) {
    return NextResponse.json({ error: "Uživatel nenalezen nebo není aktivní" }, { status: 400 });
  }

  try {
    const { assignmentId } = await assignEquipmentToUser({
      equipmentId,
      targetUserId: targetUser,
      assignedBy: userId,
      notes: notes ? String(notes) : null,
      notify,
    });
    return NextResponse.json({ success: true, assignmentId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Chyba přiřazení";
    const status = message.includes("nenalezeno") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
