import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadEquipment, canWriteEquipment } from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";
import { parseEquipmentScanCode } from "@/lib/equipment/qr";

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
  const inv = await prisma.equipment_inventories.findUnique({
    where: { id },
    include: {
      users: { select: { first_name: true, last_name: true } },
      lines: {
        include: {
          equipment_items: {
            select: {
              id: true,
              name: true,
              asset_tag: true,
              qr_code: true,
              room_id: true,
              purchase_price: true,
              equipment_rooms: { select: { name: true, code: true } },
              equipment_categories: { select: { name: true } },
            },
          },
          expected_room: { select: { id: true, name: true, code: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!inv) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  return NextResponse.json(inv);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  const id = parseInt((await params).id, 10);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "scan");

  const inv = await prisma.equipment_inventories.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  if (inv.status === "completed") {
    return NextResponse.json({ error: "Inventura je uzavřená" }, { status: 400 });
  }

  if (action === "complete") {
    if (!(await canWriteEquipment(userId))) {
      return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
    }
    await prisma.equipment_inventories.update({
      where: { id },
      data: { status: "completed", completed_at: new Date(), updated_at: new Date() },
    });
    await logEquipmentAuditSafe({
      userId,
      action: "inventory_complete",
      tableName: "equipment_inventories",
      recordId: id,
    });
    return NextResponse.json({ ok: true });
  }

  // scan
  const code = String(body.code ?? "").trim();
  if (!code) return NextResponse.json({ error: "Chybí code" }, { status: 400 });

  const parsed = parseEquipmentScanCode(code);
  const item = await prisma.equipment_items.findFirst({
    where: {
      OR: [
        { qr_code: parsed.code || code },
        { asset_tag: parsed.code || code },
      ],
    },
  });
  if (!item) return NextResponse.json({ error: "Položka nenalezena" }, { status: 404 });
  if (!(await canWriteEquipment(userId, item.category_id))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const line = await prisma.equipment_inventory_lines.findUnique({
    where: {
      inventory_id_equipment_id: { inventory_id: id, equipment_id: item.id },
    },
  });

  let lineStatus = "found";
  if (line?.expected_room_id && item.room_id && line.expected_room_id !== item.room_id) {
    lineStatus = "unexpected";
  }

  if (line) {
    await prisma.equipment_inventory_lines.update({
      where: { id: line.id },
      data: {
        line_status: lineStatus,
        scanned_at: new Date(),
        scanned_by: userId,
      },
    });
  } else {
    await prisma.equipment_inventory_lines.create({
      data: {
        inventory_id: id,
        equipment_id: item.id,
        expected_room_id: item.room_id,
        line_status: "extra",
        scanned_at: new Date(),
        scanned_by: userId,
      },
    });
    lineStatus = "extra";
  }

  return NextResponse.json({
    ok: true,
    equipmentId: item.id,
    name: item.name,
    lineStatus,
  });
}
