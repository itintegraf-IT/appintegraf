import { prisma } from "@/lib/db";
import { EQUIPMENT_ITEM_STATUS } from "@/lib/equipment-status";

export async function assignEquipmentToUser(params: {
  equipmentId: number;
  targetUserId: number;
  assignedBy: number;
  notes?: string | null;
}): Promise<{ assignmentId: number }> {
  const item = await prisma.equipment_items.findUnique({
    where: { id: params.equipmentId },
    include: {
      equipment_assignments: {
        where: { returned_at: null },
        take: 1,
      },
    },
  });

  if (!item) throw new Error("Vybavení nenalezeno");
  if (item.status === EQUIPMENT_ITEM_STATUS.VYRAZENO) {
    throw new Error("Vyřazené vybavení nelze přiřadit");
  }
  if (item.status !== EQUIPMENT_ITEM_STATUS.SKLADEM) {
    throw new Error(`Položka „${item.name}“ není skladem`);
  }
  if (item.equipment_assignments.length > 0) {
    throw new Error(`Položka „${item.name}“ je už přiřazena`);
  }

  const assignmentId = await prisma.$transaction(async (tx) => {
    const row = await tx.equipment_assignments.create({
      data: {
        equipment_id: params.equipmentId,
        user_id: params.targetUserId,
        assigned_by: params.assignedBy,
        notes: params.notes ? String(params.notes).trim() : null,
      },
    });
    await tx.equipment_items.update({
      where: { id: params.equipmentId },
      data: { status: EQUIPMENT_ITEM_STATUS.PRIRAZENO, updated_at: new Date() },
    });
    return row.id;
  });

  return { assignmentId };
}
