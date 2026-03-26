import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";
import {
  EQUIPMENT_ITEM_STATUS,
  isEquipmentItemStatus,
} from "@/lib/equipment-status";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? "mine";
  const isAdminUser = await isAdmin(userId);
  const showAll = isAdminUser && scope === "all";

  if (showAll) {
    const items = await prisma.equipment_items.findMany({
      take: 200,
      orderBy: { id: "desc" },
      include: { equipment_categories: { select: { name: true } } },
    });
    return NextResponse.json({ equipment: items });
  }

  const items = await prisma.equipment_assignments.findMany({
    where: { user_id: userId, returned_at: null },
    include: {
      equipment_items: {
        include: { equipment_categories: { select: { name: true } } },
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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const { isAdmin } = await import("@/lib/auth-utils");
  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
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
    } = body;

    if (!name || !category_id) {
      return NextResponse.json({ error: "Vyplňte název a kategorii" }, { status: 400 });
    }

    const item = await prisma.equipment_items.create({
      data: {
        name: String(name).trim(),
        brand: brand ? String(brand).trim() : null,
        model: model ? String(model).trim() : null,
        serial_number: serial_number ? String(serial_number).trim() : null,
        description: description ? String(description).trim() : null,
        category_id: parseInt(category_id, 10),
        purchase_date: purchase_date ? new Date(purchase_date) : null,
        purchase_price: purchase_price != null ? parseFloat(purchase_price) : null,
        supplier: supplier ? String(supplier).trim() : null,
        invoice_number: invoice_number ? String(invoice_number).trim() : null,
        status: isEquipmentItemStatus(String(status))
          ? status
          : EQUIPMENT_ITEM_STATUS.SKLADEM,
        location: location ? String(location).trim() : null,
        notes: notes ? String(notes).trim() : null,
      },
    });

    return NextResponse.json({ success: true, id: item.id });
  } catch (e) {
    console.error("Equipment POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření vybavení" }, { status: 500 });
  }
}
