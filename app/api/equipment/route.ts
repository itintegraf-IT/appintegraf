import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  EQUIPMENT_ITEM_STATUS,
  isEquipmentItemStatus,
} from "@/lib/equipment-status";
import {
  canReadEquipment,
  canWriteEquipment,
  getAccessibleCategoryIds,
} from "@/lib/equipment/access";
import {
  generateUniqueAssetTag,
  generateUniqueEqQrCode,
} from "@/lib/equipment/qr";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? "all";
  const q = (searchParams.get("q") ?? "").trim();
  const categoryId = searchParams.get("category_id");
  const roomId = searchParams.get("room_id");
  const status = searchParams.get("status");

  const accessible = await getAccessibleCategoryIds(userId);
  const categoryFilter =
    categoryId && Number.isFinite(parseInt(categoryId, 10))
      ? parseInt(categoryId, 10)
      : null;

  if (scope === "mine") {
    const items = await prisma.equipment_assignments.findMany({
      where: { user_id: userId, returned_at: null },
      include: {
        equipment_items: {
          include: {
            equipment_categories: { select: { name: true } },
            equipment_rooms: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { assigned_at: "desc" },
    });
    type AssignmentRow = (typeof items)[number];
    const equipment = items.map((a: AssignmentRow) => ({
      ...a.equipment_items,
      assignment_id: a.id,
    }));
    return NextResponse.json({ equipment });
  }

  const where: Record<string, unknown> = {};
  if (accessible !== null) {
    where.category_id = { in: accessible };
  }
  if (categoryFilter != null) {
    where.category_id =
      accessible === null
        ? categoryFilter
        : { in: accessible.filter((id) => id === categoryFilter) };
  }
  if (roomId) where.room_id = parseInt(roomId, 10);
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { asset_tag: { contains: q } },
      { qr_code: { contains: q } },
      { serial_number: { contains: q } },
      { brand: { contains: q } },
      { model: { contains: q } },
    ];
  }

  const items = await prisma.equipment_items.findMany({
    where,
    take: 500,
    orderBy: { id: "desc" },
    include: {
      equipment_categories: { select: { id: true, name: true } },
      equipment_rooms: { select: { id: true, name: true, code: true } },
    },
  });
  return NextResponse.json({ equipment: items });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);

  try {
    const body = await req.json();
    const {
      name,
      brand = "",
      model = "",
      serial_number = "",
      description = "",
      category_id,
      purchase_date = null,
      purchase_price = null,
      supplier = "",
      invoice_number = "",
      status = "skladem",
      location = "",
      notes = "",
      room_id = null,
      warranty_until = null,
      last_service_at = null,
      pool_qr_code = null,
    } = body;

    if (!name || !category_id) {
      return NextResponse.json({ error: "Vyplňte název a kategorii" }, { status: 400 });
    }

    const catId = parseInt(String(category_id), 10);
    if (!(await canWriteEquipment(userId, catId))) {
      return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
    }

    let roomId: number | null = null;
    let locationText = location ? String(location).trim() : null;
    if (room_id != null && room_id !== "") {
      roomId = parseInt(String(room_id), 10);
      const room = await prisma.equipment_rooms.findUnique({ where: { id: roomId } });
      if (room) locationText = `${room.code} – ${room.name}`;
    }

    let asset_tag = await generateUniqueAssetTag();
    let qr_code = await generateUniqueEqQrCode();
    let usePool = false;

    if (pool_qr_code) {
      const pool = await prisma.equipment_qr_pool.findFirst({
        where: {
          OR: [
            { qr_code: String(pool_qr_code).trim() },
            { asset_tag: String(pool_qr_code).trim() },
          ],
          status: "available",
        },
      });
      if (pool) {
        asset_tag = pool.asset_tag;
        qr_code = pool.qr_code;
        usePool = true;
      }
    }

    const item = await prisma.equipment_items.create({
      data: {
        name: String(name).trim(),
        brand: brand ? String(brand).trim() : null,
        model: model ? String(model).trim() : null,
        serial_number: serial_number ? String(serial_number).trim() : null,
        asset_tag,
        qr_code,
        description: description ? String(description).trim() : null,
        category_id: catId,
        purchase_date: purchase_date ? new Date(purchase_date) : null,
        purchase_price: purchase_price != null ? parseFloat(purchase_price) : null,
        supplier: supplier ? String(supplier).trim() : null,
        invoice_number: invoice_number ? String(invoice_number).trim() : null,
        status: isEquipmentItemStatus(String(status))
          ? status
          : EQUIPMENT_ITEM_STATUS.SKLADEM,
        location: locationText,
        room_id: roomId,
        warranty_until: warranty_until ? new Date(warranty_until) : null,
        last_service_at: last_service_at ? new Date(last_service_at) : null,
        notes: notes ? String(notes).trim() : null,
      },
    });

    if (usePool && pool_qr_code) {
      await prisma.equipment_qr_pool.updateMany({
        where: {
          OR: [
            { qr_code: String(pool_qr_code).trim() },
            { asset_tag: String(pool_qr_code).trim() },
          ],
          status: "available",
        },
        data: {
          status: "assigned",
          equipment_id: item.id,
          assigned_at: new Date(),
          assigned_by: userId,
        },
      });
    }

    await logEquipmentAuditSafe({
      userId,
      action: "item_create",
      tableName: "equipment_items",
      recordId: item.id,
    });

    return NextResponse.json({ success: true, id: item.id });
  } catch (e) {
    console.error("Equipment POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření vybavení" }, { status: 500 });
  }
}
