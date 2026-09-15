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
  if (roomId === "unassigned" || roomId === "null") {
    where.room_id = null;
  } else if (roomId) {
    where.room_id = parseInt(roomId, 10);
  }
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
    take: 2000,
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
      serial_numbers: serialNumbersRaw,
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

    const itemStatus = isEquipmentItemStatus(String(status))
      ? status
      : EQUIPMENT_ITEM_STATUS.SKLADEM;

    const shared = {
      name: String(name).trim(),
      brand: brand ? String(brand).trim() : null,
      model: model ? String(model).trim() : null,
      description: description ? String(description).trim() : null,
      category_id: catId,
      purchase_date: purchase_date ? new Date(purchase_date) : null,
      purchase_price:
        purchase_price != null && purchase_price !== ""
          ? parseFloat(String(purchase_price))
          : null,
      supplier: supplier ? String(supplier).trim() : null,
      invoice_number: invoice_number ? String(invoice_number).trim() : null,
      status: itemStatus,
      location: locationText,
      room_id: roomId,
      warranty_until: warranty_until ? new Date(warranty_until) : null,
      last_service_at: last_service_at ? new Date(last_service_at) : null,
      notes: notes ? String(notes).trim() : null,
    };

    /** Hromadné založení: pole serial_numbers (každý kus = jedno SN). */
    const bulkSerials: string[] | null = Array.isArray(serialNumbersRaw)
      ? serialNumbersRaw.map((s: unknown) => String(s ?? "").trim()).filter(Boolean)
      : null;

    if (bulkSerials && bulkSerials.length > 1) {
      if (bulkSerials.length > 50) {
        return NextResponse.json(
          { error: "Najednou lze založit maximálně 50 kusů" },
          { status: 400 }
        );
      }

      const uniqueCheck = new Set(bulkSerials.map((s) => s.toLowerCase()));
      if (uniqueCheck.size !== bulkSerials.length) {
        return NextResponse.json(
          { error: "Sériová čísla musí být unikátní (duplicita ve formuláři)" },
          { status: 400 }
        );
      }

      const existingSn = await prisma.equipment_items.findMany({
        where: { serial_number: { in: bulkSerials } },
        select: { serial_number: true },
      });
      if (existingSn.length > 0) {
        const taken = existingSn.map((e) => e.serial_number).filter(Boolean).join(", ");
        return NextResponse.json(
          { error: `Sériové číslo už existuje: ${taken}` },
          { status: 400 }
        );
      }

      const rows: Array<{
        serial_number: string;
        asset_tag: string;
        qr_code: string;
      }> = [];
      for (const sn of bulkSerials) {
        rows.push({
          serial_number: sn,
          asset_tag: await generateUniqueAssetTag(),
          qr_code: await generateUniqueEqQrCode(),
        });
      }

      await prisma.equipment_items.createMany({
        data: rows.map((r) => ({
          ...shared,
          serial_number: r.serial_number,
          asset_tag: r.asset_tag,
          qr_code: r.qr_code,
        })),
      });

      const created = await prisma.equipment_items.findMany({
        where: { serial_number: { in: bulkSerials } },
        select: { id: true, serial_number: true },
        orderBy: { id: "asc" },
      });
      const bySn = new Map(created.map((c) => [c.serial_number, c.id]));
      const createdIds = bulkSerials
        .map((sn) => bySn.get(sn))
        .filter((id): id is number => typeof id === "number");

      for (const id of createdIds) {
        await logEquipmentAuditSafe({
          userId,
          action: "item_create",
          tableName: "equipment_items",
          recordId: id,
          detail: { bulk: true, count: createdIds.length },
        });
      }

      return NextResponse.json({
        success: true,
        id: createdIds[0],
        ids: createdIds,
        count: createdIds.length,
      });
    }

    const singleSn =
      bulkSerials && bulkSerials.length === 1
        ? bulkSerials[0]
        : serial_number
          ? String(serial_number).trim()
          : null;

    if (singleSn) {
      const clash = await prisma.equipment_items.findFirst({
        where: { serial_number: singleSn },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json(
          { error: `Sériové číslo už existuje: ${singleSn}` },
          { status: 400 }
        );
      }
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
        ...shared,
        serial_number: singleSn,
        asset_tag,
        qr_code,
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

    return NextResponse.json({ success: true, id: item.id, ids: [item.id], count: 1 });
  } catch (e) {
    console.error("Equipment POST error:", e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint") || msg.includes("serial_number")) {
      return NextResponse.json(
        { error: "Sériové číslo nebo inventární kód už existuje" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Chyba při vytváření vybavení" }, { status: 500 });
  }
}
