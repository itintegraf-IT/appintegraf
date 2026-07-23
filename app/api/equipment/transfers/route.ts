import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canWriteEquipment } from "@/lib/equipment/access";
import {
  transferEquipmentToRoom,
  transferManyEquipmentToRoom,
} from "@/lib/equipment/room-transfer";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  const body = await req.json().catch(() => ({}));
  const toRoomId = parseInt(String(body.to_room_id ?? ""), 10);
  const notes = body.notes ? String(body.notes) : null;

  if (!Number.isFinite(toRoomId)) {
    return NextResponse.json({ error: "Chybí to_room_id" }, { status: 400 });
  }

  const ids: number[] = Array.isArray(body.equipment_ids)
    ? body.equipment_ids.map((x: unknown) => parseInt(String(x), 10)).filter((n: number) => Number.isFinite(n))
    : body.equipment_id != null
      ? [parseInt(String(body.equipment_id), 10)].filter((n) => Number.isFinite(n))
      : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Chybí equipment_id(s)" }, { status: 400 });
  }

  const items = await prisma.equipment_items.findMany({
    where: { id: { in: ids } },
    select: { id: true, category_id: true },
  });
  for (const item of items) {
    if (!(await canWriteEquipment(userId, item.category_id))) {
      return NextResponse.json(
        { error: `Nemáte oprávnění k položce #${item.id}` },
        { status: 403 }
      );
    }
  }

  try {
    if (ids.length === 1) {
      const result = await transferEquipmentToRoom({
        equipmentId: ids[0],
        toRoomId,
        userId,
        source: "manual",
        notes,
      });
      return NextResponse.json({
        ok: true,
        results: [result],
        protocolUrl: `/equipment/protokol/presun-mistnosti?historyId=${result.historyId}`,
      });
    }
    const results = await transferManyEquipmentToRoom({
      equipmentIds: ids,
      toRoomId,
      userId,
      notes,
    });
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chyba přesunu" },
      { status: 400 }
    );
  }
}
