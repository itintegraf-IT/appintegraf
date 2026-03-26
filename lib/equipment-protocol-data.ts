import { prisma } from "@/lib/db";
import type { Decimal } from "@prisma/client/runtime/library";

/** Data pro tisk protokolů — odpovídá dotazům v PHP print-protocol / print-return-protocol */
export type AssignmentProtocolRow = {
  assignmentId: number;
  assigned_at: Date;
  returned_at: Date | null;
  notes: string | null;
  user: {
    first_name: string;
    last_name: string;
    position: string | null;
    department_name: string | null;
    email: string | null;
    phone: string | null;
  };
  equipment: {
    id: number;
    name: string;
    brand: string | null;
    model: string | null;
    serial_number: string | null;
    description: string | null;
    purchase_date: Date | null;
    purchase_price: Decimal | null;
  };
};

export async function getAssignmentProtocolById(
  assignmentId: number,
): Promise<AssignmentProtocolRow | null> {
  const row = await prisma.equipment_assignments.findUnique({
    where: { id: assignmentId },
    include: {
      users_equipment_assignments_user_idTousers: {
        select: {
          first_name: true,
          last_name: true,
          position: true,
          department_name: true,
          email: true,
          phone: true,
        },
      },
      equipment_items: {
        select: {
          id: true,
          name: true,
          brand: true,
          model: true,
          serial_number: true,
          description: true,
          purchase_date: true,
          purchase_price: true,
        },
      },
    },
  });

  if (!row || !row.users_equipment_assignments_user_idTousers || !row.equipment_items) {
    return null;
  }

  const u = row.users_equipment_assignments_user_idTousers;
  const e = row.equipment_items;

  return {
    assignmentId: row.id,
    assigned_at: row.assigned_at,
    returned_at: row.returned_at,
    notes: row.notes,
    user: {
      first_name: u.first_name,
      last_name: u.last_name,
      position: u.position,
      department_name: u.department_name,
      email: u.email,
      phone: u.phone,
    },
    equipment: {
      id: e.id,
      name: e.name,
      brand: e.brand,
      model: e.model,
      serial_number: e.serial_number,
      description: e.description,
      purchase_date: e.purchase_date,
      purchase_price: e.purchase_price,
    },
  };
}
