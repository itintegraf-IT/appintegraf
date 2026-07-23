import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canWriteEquipment } from "@/lib/equipment/access";
import { transferEquipmentToRoom } from "@/lib/equipment/room-transfer";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  const body = await req.json().catch(() => ({}));

  const equipmentId = parseInt(String(body.equipment_id ?? ""), 10);
  const toRoomId = parseInt(String(body.to_room_id ?? body.room_id ?? ""), 10);
  const notes = body.notes ? String(body.notes) : null;
  const source = body.source === "manual" || body.source === "bulk" ? body.source : "scan";

  if (!Number.isFinite(equipmentId) || !Number.isFinite(toRoomId)) {
    return NextResponse.json({ error: "Chybí equipment_id nebo room_id" }, { status: 400 });
  }

  const item = await prisma.equipment_items.findUnique({
    where: { id: equipmentId },
    select: { category_id: true },
  });
  if (!item) return NextResponse.json({ error: "Položka nenalezena" }, { status: 404 });
  if (!(await canWriteEquipment(userId, item.category_id))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const result = await transferEquipmentToRoom({
      equipmentId,
      toRoomId,
      userId,
      source,
      notes,
    });
    return NextResponse.json({
      ok: true,
      ...result,
      protocolUrl: `/equipment/protokol/presun-mistnosti?historyId=${result.historyId}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chyba přesunu" },
      { status: 400 }
    );
  }
}
