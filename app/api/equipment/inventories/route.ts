import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  canAdministerEquipment,
  canReadEquipment,
  canWriteEquipment,
  getAccessibleCategoryIds,
} from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";
import { validateInventoryCreate } from "@/lib/equipment/inventory-rules";

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
  const body: unknown = await req.json().catch(() => ({}));
  const validated = validateInventoryCreate(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const { scopeType, scopeId, name } = validated;

  // Celofiremní inventura jen pro správce; skupina jen se zápisem do ní; místnost se zápisem do některé skupiny.
  const allowed =
    scopeType === "all"
      ? await canAdministerEquipment(userId)
      : scopeType === "category"
        ? await canWriteEquipment(userId, scopeId ?? undefined)
        : await canWriteEquipment(userId);
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          scopeType === "all" ? "Celofiremní inventuru může založit jen správce majetku." : "Nemáte oprávnění",
      },
      { status: 403 }
    );
  }

  const accessible = await getAccessibleCategoryIds(userId);
  const notes =
    body && typeof body === "object" && typeof (body as { notes?: unknown }).notes === "string"
      ? ((body as { notes: string }).notes.trim().slice(0, 5000) || null)
      : null;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Zámek rozsahu: dvě souběžná založení pro stejnou místnost/skupinu se seřadí za sebe.
        if (scopeType === "room") {
          const rows = await tx.$queryRaw<{ is_active: unknown }[]>`SELECT is_active FROM equipment_rooms WHERE id = ${scopeId} FOR UPDATE`;
          if (rows.length === 0 || Number(rows[0].is_active) === 0) return { status: "not_found" as const };
        } else if (scopeType === "category") {
          const rows = await tx.$queryRaw<{ is_active: unknown }[]>`SELECT is_active FROM equipment_categories WHERE id = ${scopeId} FOR UPDATE`;
          if (rows.length === 0 || (rows[0].is_active !== null && Number(rows[0].is_active) === 0)) {
            return { status: "not_found" as const };
          }
        }

        const existing = await tx.equipment_inventories.findFirst({
          where: { status: "in_progress", scope_type: scopeType, scope_id: scopeId },
          select: { id: true },
        });
        if (existing) return { status: "exists" as const, existingId: existing.id };

        const where: Prisma.equipment_itemsWhereInput = { status: { not: "vyřazeno" } };
        if (scopeType === "category") where.category_id = scopeId ?? undefined;
        else if (accessible !== null) where.category_id = { in: accessible };
        if (scopeType === "room") where.room_id = scopeId;

        const items = await tx.equipment_items.findMany({ where, select: { id: true, room_id: true } });
        const inventory = await tx.equipment_inventories.create({
          data: { name, status: "in_progress", scope_type: scopeType, scope_id: scopeId, created_by: userId, notes },
        });
        if (items.length > 0) {
          await tx.equipment_inventory_lines.createMany({
            data: items.map((it) => ({
              inventory_id: inventory.id,
              equipment_id: it.id,
              expected_room_id: it.room_id,
              line_status: "missing",
            })),
          });
        }
        return { status: "created" as const, inventory, lines: items.length };
      },
      { maxWait: 5000, timeout: 20000 }
    );

    if (result.status === "not_found") {
      return NextResponse.json(
        { error: scopeType === "room" ? "Místnost neexistuje nebo není aktivní." : "Skupina neexistuje nebo není aktivní." },
        { status: 404 }
      );
    }
    if (result.status === "exists") {
      return NextResponse.json(
        { error: "Pro tento rozsah už probíhá inventura.", existingId: result.existingId },
        { status: 409 }
      );
    }

    await logEquipmentAuditSafe({
      userId,
      action: "inventory_create",
      tableName: "equipment_inventories",
      recordId: result.inventory.id,
      detail: { scopeType, scopeId, lines: result.lines },
    });
    return NextResponse.json(result.inventory, { status: 201 });
  } catch (e) {
    console.error("inventories POST:", e);
    return NextResponse.json({ error: "Inventuru se nepodařilo založit" }, { status: 500 });
  }
}
