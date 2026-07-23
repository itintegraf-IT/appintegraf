import { prisma } from "@/lib/db";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";

export type TransferSource = "scan" | "manual" | "bulk";

export type TransferResult = {
  historyId: number;
  protocolNumber: string;
  fromRoomId: number | null;
  toRoomId: number;
};

function protocolNumberFor(id: number): string {
  const year = new Date().getFullYear();
  return `PM-${year}-${id}`;
}

export async function transferEquipmentToRoom(params: {
  equipmentId: number;
  toRoomId: number;
  userId: number;
  source: TransferSource;
  notes?: string | null;
}): Promise<TransferResult> {
  const item = await prisma.equipment_items.findUnique({
    where: { id: params.equipmentId },
    select: { id: true, room_id: true, status: true },
  });
  if (!item) throw new Error("Položka nenalezena");
  if (item.status === "vyřazeno") throw new Error("Vyřazený majetek nelze přesouvat");

  const room = await prisma.equipment_rooms.findUnique({
    where: { id: params.toRoomId },
    select: { id: true, name: true, code: true, is_active: true },
  });
  if (!room || !room.is_active) throw new Error("Cílová místnost není aktivní");
  if (item.room_id === params.toRoomId) {
    throw new Error("Položka už je v této místnosti");
  }

  const fromRoomId = item.room_id;
  const locationText = [room.code, room.name].filter(Boolean).join(" – ");

  const history = await prisma.$transaction(async (tx) => {
    await tx.equipment_items.update({
      where: { id: params.equipmentId },
      data: {
        room_id: params.toRoomId,
        location: locationText,
        updated_at: new Date(),
      },
    });

    const row = await tx.equipment_location_history.create({
      data: {
        equipment_id: params.equipmentId,
        from_room_id: fromRoomId,
        to_room_id: params.toRoomId,
        transferred_by: params.userId,
        source: params.source,
        notes: params.notes?.trim() || null,
      },
    });

    const protocol = protocolNumberFor(row.id);
    return tx.equipment_location_history.update({
      where: { id: row.id },
      data: { protocol_number: protocol },
    });
  });

  await logEquipmentAuditSafe({
    userId: params.userId,
    action: "room_transfer",
    tableName: "equipment_location_history",
    recordId: history.id,
    detail: {
      historyId: history.id,
      equipmentId: params.equipmentId,
      fromRoomId,
      toRoomId: params.toRoomId,
      source: params.source,
      protocolNumber: history.protocol_number,
    },
  });

  return {
    historyId: history.id,
    protocolNumber: history.protocol_number ?? protocolNumberFor(history.id),
    fromRoomId,
    toRoomId: params.toRoomId,
  };
}

export async function transferManyEquipmentToRoom(params: {
  equipmentIds: number[];
  toRoomId: number;
  userId: number;
  notes?: string | null;
}): Promise<TransferResult[]> {
  const results: TransferResult[] = [];
  for (const equipmentId of params.equipmentIds) {
    results.push(
      await transferEquipmentToRoom({
        equipmentId,
        toRoomId: params.toRoomId,
        userId: params.userId,
        source: "bulk",
        notes: params.notes,
      })
    );
  }
  return results;
}
