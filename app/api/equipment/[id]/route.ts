import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { EQUIPMENT_ITEM_STATUS, isEquipmentItemStatus } from "@/lib/equipment-status";
import { canReadEquipment, canWriteEquipment, canAdministerEquipment } from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const item = await prisma.equipment_items.findUnique({
    where: { id },
    include: {
      equipment_categories: {
        select: {
          id: true,
          name: true,
          responsible_user_id: true,
          users_responsible: { select: { id: true, first_name: true, last_name: true } },
        },
      },
      equipment_rooms: true,
      location_history: {
        orderBy: { transferred_at: "desc" },
        take: 50,
        include: {
          room_from: { select: { id: true, name: true, code: true } },
          room_to: { select: { id: true, name: true, code: true } },
          users: { select: { first_name: true, last_name: true } },
        },
      },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Vybavení nenalezeno" }, { status: 404 });
  }
  if (!(await canReadEquipment(userId, item.category_id))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  return NextResponse.json(item);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.equipment_items.findUnique({
    where: { id },
    select: { category_id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }
  if (!(await canWriteEquipment(userId, existing.category_id))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

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
      disposed_at = null,
      disposal_reason = "",
    } = body;

    if (!name || !category_id) {
      return NextResponse.json({ error: "Vyplňte název a kategorii" }, { status: 400 });
    }

    const catId = parseInt(String(category_id), 10);
    if (catId !== existing.category_id && !(await canWriteEquipment(userId, catId))) {
      return NextResponse.json({ error: "Nemáte oprávnění k cílové skupině" }, { status: 403 });
    }

    let roomId: number | null = null;
    let locationText = location ? String(location).trim() : null;
    if (room_id != null && room_id !== "") {
      roomId = parseInt(String(room_id), 10);
      const room = await prisma.equipment_rooms.findUnique({ where: { id: roomId } });
      if (room) locationText = `${room.code} – ${room.name}`;
    } else if (room_id === null || room_id === "") {
      roomId = null;
    }

    await prisma.equipment_items.update({
      where: { id },
      data: {
        name: String(name).trim(),
        brand: brand ? String(brand).trim() : null,
        model: model ? String(model).trim() : null,
        serial_number: serial_number ? String(serial_number).trim() : null,
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
        disposed_at: disposed_at ? new Date(disposed_at) : null,
        disposal_reason: disposal_reason ? String(disposal_reason).trim() : null,
        notes: notes ? String(notes).trim() : null,
        updated_at: new Date(),
      },
    });

    await logEquipmentAuditSafe({
      userId,
      action: "item_update",
      tableName: "equipment_items",
      recordId: id,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Equipment PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání vybavení" }, { status: 500 });
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
    return NextResponse.json({ error: "Nemáte oprávnění mazat vybavení" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  try {
    await prisma.equipment_items.delete({ where: { id } });
    await logEquipmentAuditSafe({
      userId,
      action: "item_delete",
      tableName: "equipment_items",
      recordId: id,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Equipment DELETE error:", e);
    return NextResponse.json({ error: "Chyba při mazání vybavení" }, { status: 500 });
  }
}
