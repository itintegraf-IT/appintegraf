import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAdministerEquipment, canReadEquipment, getAccessibleCategoryIds } from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";
import {
  defaultPlanColor,
  parseRoomPolygon,
  serializeRoomPolygon,
} from "@/lib/equipment/floor-plan";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const room = await prisma.equipment_rooms.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });

  const catFilter = await getAccessibleCategoryIds(userId);
  const items = await prisma.equipment_items.findMany({
    where: {
      room_id: id,
      ...(catFilter === null ? {} : { category_id: { in: catFilter } }),
    },
    orderBy: { name: "asc" },
    take: 500,
    include: {
      equipment_categories: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    ...room,
    polygon: parseRoomPolygon(room.polygon_json),
    items,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = { updated_at: new Date() };
  if (body.name != null) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "Název nemůže být prázdný" }, { status: 400 });
    }
    data.name = name;
  }
  if (body.code != null) {
    const code = String(body.code).trim().toUpperCase().slice(0, 40);
    if (!code) {
      return NextResponse.json({ error: "Kód nemůže být prázdný" }, { status: 400 });
    }
    data.code = code;
  }
  if (body.building !== undefined) data.building = body.building ? String(body.building).trim() : null;
  if (body.floor !== undefined) data.floor = body.floor ? String(body.floor).trim() : null;
  if (body.description !== undefined) {
    data.description = body.description ? String(body.description).trim() : null;
  }
  if (body.is_active !== undefined) data.is_active = Boolean(body.is_active);
  if (body.floor_plan_id !== undefined) {
    if (body.floor_plan_id === null || body.floor_plan_id === "") {
      data.floor_plan_id = null;
    } else {
      const fpid = parseInt(String(body.floor_plan_id), 10);
      data.floor_plan_id = Number.isFinite(fpid) ? fpid : null;
    }
  }
  if (body.polygon !== undefined) {
    if (body.polygon === null) {
      data.polygon_json = null;
    } else {
      const polygon = parseRoomPolygon(body.polygon);
      if (!polygon) {
        return NextResponse.json(
          { error: "Polygon musí mít alespoň 3 body (souřadnice 0–1)" },
          { status: 400 }
        );
      }
      data.polygon_json = serializeRoomPolygon(polygon);
    }
  }
  if (body.plan_color !== undefined) {
    data.plan_color = body.plan_color
      ? String(body.plan_color).trim().slice(0, 20)
      : defaultPlanColor(id);
  }

  try {
    const row = await prisma.equipment_rooms.update({ where: { id }, data });
    await logEquipmentAuditSafe({
      userId,
      action: "room_update",
      tableName: "equipment_rooms",
      recordId: id,
      detail: data,
    });
    return NextResponse.json({ ...row, polygon: parseRoomPolygon(row.polygon_json) });
  } catch {
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.equipment_rooms.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }

  const itemCount = await prisma.equipment_items.count({ where: { room_id: id } });
  if (itemCount > 0) {
    return NextResponse.json(
      { error: "Místnost obsahuje položky – deaktivujte ji." },
      { status: 400 }
    );
  }

  const histTo = await prisma.equipment_location_history.count({ where: { to_room_id: id } });
  if (histTo > 0) {
    await prisma.equipment_rooms.update({
      where: { id },
      data: { is_active: false, updated_at: new Date() },
    });
    await logEquipmentAuditSafe({
      userId,
      action: "room_deactivate",
      tableName: "equipment_rooms",
      recordId: id,
      detail: { reason: "history_references" },
    });
    return NextResponse.json({ ok: true, deactivated: true });
  }

  await prisma.equipment_rooms.delete({ where: { id } });
  await logEquipmentAuditSafe({
    userId,
    action: "room_delete",
    tableName: "equipment_rooms",
    recordId: id,
    detail: { name: existing.name, code: existing.code },
  });
  return NextResponse.json({ ok: true });
}
