import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAdministerEquipment, canReadEquipment, getAccessibleCategoryIds } from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";
import { parseRoomPolygon } from "@/lib/equipment/floor-plan";

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

  const catFilter = await getAccessibleCategoryIds(userId);
  const itemWhere = catFilter === null ? {} : { category_id: { in: catFilter } };

  const plan = await prisma.equipment_floor_plans.findUnique({
    where: { id },
    include: {
      rooms: {
        where: { is_active: true },
        orderBy: { code: "asc" },
        include: {
          _count: { select: { equipment_items: true } },
          equipment_items: {
            where: itemWhere,
            orderBy: { name: "asc" },
            take: 80,
            select: {
              id: true,
              name: true,
              asset_tag: true,
              status: true,
              equipment_categories: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!plan || !plan.is_active) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }

  const rooms = plan.rooms.map((r) => ({
    ...r,
    polygon: parseRoomPolygon(r.polygon_json),
    items: r.equipment_items,
  }));

  return NextResponse.json({ ...plan, rooms });
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
  const data: {
    name?: string;
    floor_label?: string;
    building?: string | null;
    sort_order?: number;
    image_width?: number | null;
    image_height?: number | null;
    is_active?: boolean;
    updated_at: Date;
  } = { updated_at: new Date() };

  if (body.name != null) data.name = String(body.name).trim();
  if (body.floor_label != null) data.floor_label = String(body.floor_label).trim().slice(0, 40);
  if (body.building !== undefined) {
    data.building = body.building ? String(body.building).trim() : null;
  }
  if (body.sort_order !== undefined) {
    const n = parseInt(String(body.sort_order), 10);
    if (Number.isFinite(n)) data.sort_order = n;
  }
  if (body.image_width != null) {
    const w = parseInt(String(body.image_width), 10);
    data.image_width = Number.isFinite(w) ? w : null;
  }
  if (body.image_height != null) {
    const h = parseInt(String(body.image_height), 10);
    data.image_height = Number.isFinite(h) ? h : null;
  }
  if (body.is_active !== undefined) data.is_active = Boolean(body.is_active);

  try {
    const row = await prisma.equipment_floor_plans.update({ where: { id }, data });
    await logEquipmentAuditSafe({
      userId,
      action: "floor_plan_update",
      tableName: "equipment_floor_plans",
      recordId: id,
      detail: data,
    });
    return NextResponse.json(row);
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

  await prisma.$transaction([
    prisma.equipment_rooms.updateMany({
      where: { floor_plan_id: id },
      data: { floor_plan_id: null, polygon_json: null, updated_at: new Date() },
    }),
    prisma.equipment_floor_plans.update({
      where: { id },
      data: { is_active: false, updated_at: new Date() },
    }),
  ]);

  await logEquipmentAuditSafe({
    userId,
    action: "floor_plan_deactivate",
    tableName: "equipment_floor_plans",
    recordId: id,
  });

  return NextResponse.json({ ok: true });
}
