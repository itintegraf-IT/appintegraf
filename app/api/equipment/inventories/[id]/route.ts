import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAdministerEquipment, canReadEquipment, canWriteEquipment } from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";
import { nextInventoryLineStatus, summarizeInventoryLines } from "@/lib/equipment/inventory-rules";
import { resolveScanCode } from "@/lib/equipment/scan-resolve";

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
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const action = body.action == null ? "scan" : String(body.action);
  if (action !== "scan" && action !== "complete") {
    return NextResponse.json({ error: "Neznámá akce" }, { status: 400 });
  }

  const inv = await prisma.equipment_inventories.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  if (inv.status === "completed") {
    return NextResponse.json({ error: "Inventura je uzavřená" }, { status: 400 });
  }

  if (action === "complete") {
    if (inv.created_by !== userId && !(await canAdministerEquipment(userId))) {
      return NextResponse.json(
        { error: "Inventuru může uzavřít ten, kdo ji založil, nebo správce majetku." },
        { status: 403 }
      );
    }
    const lines = await prisma.equipment_inventory_lines.findMany({
      where: { inventory_id: id },
      select: { line_status: true },
    });
    const summary = summarizeInventoryLines(lines);
    // Podmíněná změna: dvě souběžná uzavření neprojdou obě.
    const closed = await prisma.equipment_inventories.updateMany({
      where: { id, status: "in_progress" },
      data: { status: "completed", completed_at: new Date(), updated_at: new Date() },
    });
    if (closed.count !== 1) {
      return NextResponse.json({ error: "Inventura je uzavřená" }, { status: 400 });
    }
    await logEquipmentAuditSafe({
      userId,
      action: "inventory_complete",
      tableName: "equipment_inventories",
      recordId: id,
      oldValues: { status: inv.status },
      detail: { status: "completed", ...summary },
    });
    return NextResponse.json({ ok: true, summary });
  }

  // scan
  const code = String(body.code ?? "").trim();
  if (!code) return NextResponse.json({ error: "Chybí kód" }, { status: 400 });

  const { resolution } = await resolveScanCode(code, "item");
  if (resolution.type === "wrong_kind") {
    return NextResponse.json(
      { error: "Toto je QR kód místnosti. V inventuře skenujte položky." },
      { status: 400 }
    );
  }
  if (resolution.type === "qr_pool") {
    return NextResponse.json(
      { error: "Tento kód z fondu QR ještě není přiřazený žádné položce." },
      { status: 400 }
    );
  }
  const item =
    resolution.type === "item"
      ? await prisma.equipment_items.findUnique({ where: { id: resolution.itemId } })
      : null;
  if (!item) return NextResponse.json({ error: "Položka nenalezena" }, { status: 404 });
  if (!(await canWriteEquipment(userId, item.category_id))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const line = await prisma.equipment_inventory_lines.findUnique({
    where: {
      inventory_id_equipment_id: { inventory_id: id, equipment_id: item.id },
    },
  });

  const { status: lineStatus, alreadyScanned } = nextInventoryLineStatus(line, item.room_id);

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
        line_status: lineStatus,
        scanned_at: new Date(),
        scanned_by: userId,
      },
    });
  }

  await logEquipmentAuditSafe({
    userId,
    action: "inventory_scan",
    tableName: "equipment_inventory_lines",
    recordId: id,
    oldValues: { equipmentId: item.id, line_status: line?.line_status ?? null },
    detail: { equipmentId: item.id, line_status: lineStatus },
  });

  return NextResponse.json({
    ok: true,
    equipmentId: item.id,
    name: item.name,
    lineStatus,
    alreadyScanned,
  });
}
