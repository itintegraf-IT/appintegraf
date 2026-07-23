import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadEquipment } from "@/lib/equipment/access";
import { parseEquipmentScanCode } from "@/lib/equipment/qr";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  const codeParam = req.nextUrl.searchParams.get("code") ?? "";
  if (!codeParam.trim()) {
    return NextResponse.json({ error: "Chybí code" }, { status: 400 });
  }

  const parsed = parseEquipmentScanCode(codeParam);
  const code = parsed.code || codeParam.trim();

  // Místnost
  if (parsed.kind === "rm" || parsed.kind === "raw") {
    const room = await prisma.equipment_rooms.findFirst({
      where: {
        OR: [{ qr_code: code }, { code }],
        is_active: true,
      },
    });
    if (room) {
      if (!(await canReadEquipment(userId))) {
        return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
      }
      return NextResponse.json({
        type: "room",
        id: room.id,
        name: room.name,
        code: room.code,
        qr_code: room.qr_code,
        building: room.building,
        floor: room.floor,
      });
    }
  }

  // Fond QR
  const pool = await prisma.equipment_qr_pool.findFirst({
    where: { OR: [{ qr_code: code }, { asset_tag: code }] },
  });
  if (pool) {
    if (pool.status === "assigned" && pool.equipment_id) {
      const item = await prisma.equipment_items.findUnique({
        where: { id: pool.equipment_id },
        include: {
          equipment_categories: { select: { id: true, name: true } },
          equipment_rooms: { select: { id: true, name: true, code: true } },
        },
      });
      if (item && (await canReadEquipment(userId, item.category_id))) {
        return NextResponse.json({
          type: "item",
          id: item.id,
          name: item.name,
          asset_tag: item.asset_tag,
          qr_code: item.qr_code,
          category: item.equipment_categories,
          room: item.equipment_rooms,
          purchase_price: item.purchase_price,
          status: item.status,
        });
      }
    }
    if (!(await canReadEquipment(userId))) {
      return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
    }
    return NextResponse.json({
      type: "qr_pool",
      id: pool.id,
      qr_code: pool.qr_code,
      asset_tag: pool.asset_tag,
      status: pool.status,
      equipment_id: pool.equipment_id,
    });
  }

  // Položka majetku
  const item = await prisma.equipment_items.findFirst({
    where: {
      OR: [{ qr_code: code }, { asset_tag: code }, { serial_number: code }],
    },
    include: {
      equipment_categories: { select: { id: true, name: true } },
      equipment_rooms: { select: { id: true, name: true, code: true } },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Kód nenalezen" }, { status: 404 });
  }
  if (!(await canReadEquipment(userId, item.category_id))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  return NextResponse.json({
    type: "item",
    id: item.id,
    name: item.name,
    asset_tag: item.asset_tag,
    qr_code: item.qr_code,
    category: item.equipment_categories,
    room: item.equipment_rooms,
    purchase_price: item.purchase_price,
    status: item.status,
  });
}
