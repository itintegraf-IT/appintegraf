import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const item = await prisma.equipment_items.findUnique({
    where: { id },
    include: { equipment_categories: { select: { id: true, name: true } } },
  });

  if (!item) {
    return NextResponse.json({ error: "Vybavení nenalezeno" }, { status: 404 });
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
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
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

    await prisma.equipment_items.update({
      where: { id },
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
        status: ["skladem", "p_i_azeno", "servis", "vy_azeno"].includes(status)
          ? status
          : "skladem",
        location: location ? String(location).trim() : null,
        notes: notes ? String(notes).trim() : null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Equipment PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání vybavení" }, { status: 500 });
  }
}
