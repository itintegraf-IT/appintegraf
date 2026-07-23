import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  canAdministerEquipment,
  canReadEquipment,
  canWriteEquipment,
  getAccessibleCategoryIds,
} from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const rows = await prisma.equipment_inventories.findMany({
    orderBy: { id: "desc" },
    take: 100,
    include: {
      users: { select: { first_name: true, last_name: true } },
      _count: { select: { lines: true } },
    },
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim() || `Inventura ${new Date().toLocaleDateString("cs-CZ")}`;
  const scopeType = ["all", "room", "category"].includes(body.scope_type)
    ? String(body.scope_type)
    : "all";
  const scopeId =
    body.scope_id != null && body.scope_id !== ""
      ? parseInt(String(body.scope_id), 10)
      : null;

  if (scopeType === "all" && !(await canAdministerEquipment(userId))) {
    // zodpovědný může inventarizovat jen své skupiny — all zakázáno
    if (!(await canWriteEquipment(userId))) {
      return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
    }
  }

  const accessible = await getAccessibleCategoryIds(userId);
  const where: Record<string, unknown> = {};
  if (scopeType === "category" && scopeId) {
    if (accessible !== null && !accessible.includes(scopeId)) {
      return NextResponse.json({ error: "Nemáte přístup ke skupině" }, { status: 403 });
    }
    where.category_id = scopeId;
  } else if (scopeType === "room" && scopeId) {
    where.room_id = scopeId;
    if (accessible !== null) where.category_id = { in: accessible };
  } else {
    if (accessible !== null) where.category_id = { in: accessible };
  }

  const items = await prisma.equipment_items.findMany({
    where: { ...where, status: { not: "vyřazeno" } },
    select: { id: true, room_id: true },
  });

  const inventory = await prisma.$transaction(async (tx) => {
    const inv = await tx.equipment_inventories.create({
      data: {
        name,
        status: "in_progress",
        scope_type: scopeType,
        scope_id: scopeId,
        created_by: userId,
        notes: body.notes ? String(body.notes) : null,
      },
    });
    if (items.length > 0) {
      await tx.equipment_inventory_lines.createMany({
        data: items.map((it) => ({
          inventory_id: inv.id,
          equipment_id: it.id,
          expected_room_id: it.room_id,
          line_status: "missing",
        })),
      });
    }
    return inv;
  });

  await logEquipmentAuditSafe({
    userId,
    action: "inventory_create",
    tableName: "equipment_inventories",
    recordId: inventory.id,
    detail: { scopeType, scopeId, lines: items.length },
  });

  return NextResponse.json(inventory, { status: 201 });
}
