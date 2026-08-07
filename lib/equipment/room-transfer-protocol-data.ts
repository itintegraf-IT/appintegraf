import { prisma } from "@/lib/db";

export async function getRoomTransferProtocolById(historyId: number) {
  return prisma.equipment_location_history.findUnique({
    where: { id: historyId },
    include: {
      equipment_items: {
        include: {
          equipment_categories: { select: { name: true } },
        },
      },
      room_from: true,
      room_to: true,
      users: {
        select: { first_name: true, last_name: true, position: true, department_name: true },
      },
    },
  });
}
