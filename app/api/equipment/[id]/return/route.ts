import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { EQUIPMENT_ITEM_STATUS } from "@/lib/equipment-status";
import { notifyEquipmentReturned } from "@/lib/equipment-movement-notify";
import { parseNotifyFlag } from "@/lib/equipment/parse-notify-flag";

/** POST – vrácení vybavení (ukončení přiřazení) */
export async function POST(
  req: NextRequest,
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

  const body = await req.json().catch(() => ({}));
  const notify = parseNotifyFlag((body as { notify?: unknown }).notify);

  const assignment = await prisma.equipment_assignments.findFirst({
    where: { equipment_id: equipmentId, returned_at: null },
  });

  if (!assignment) {
    return NextResponse.json({ error: "Vybavení není přiřazeno žádnému uživateli" }, { status: 400 });
  }

  const canReturn =
    (await isAdmin(userId)) || (await hasModuleAccess(userId, "equipment", "write"));
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
      data: { status: EQUIPMENT_ITEM_STATUS.SKLADEM, updated_at: new Date() },
    }),
  ]);

  if (notify) {
    void notifyEquipmentReturned({
      assignmentId: assignment.id,
      equipmentId,
      formerHolderUserId: assignment.user_id,
    });
  }

  return NextResponse.json({ success: true, assignmentId: assignment.id });
}
