import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k modulu IML" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const customer = await prisma.iml_customers.findUnique({
    where: { id },
    include: {
      iml_products: { select: { id: true, ig_code: true, ig_short_name: true, client_name: true } },
      iml_orders: { select: { id: true, order_number: true, order_date: true, status: true, total: true } },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Zákazník nenalezen" }, { status: 404 });
  }

  return NextResponse.json(customer);
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
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám IML" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.iml_customers.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Zákazník nenalezen" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const {
      name,
      email = null,
      phone = null,
      contact_person = null,
      allow_under_over_delivery_percent = null,
      customer_note = null,
      billing_address = null,
      shipping_address = null,
      individual_requirements = null,
      city = null,
      postal_code = null,
      country = "Česká republika",
    } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Vyplňte název zákazníka" }, { status: 400 });
    }

    if (email) {
      const dup = await prisma.iml_customers.findFirst({
        where: { email: String(email).trim(), NOT: { id } },
      });
      if (dup) {
        return NextResponse.json({ error: "Zákazník s tímto e-mailem již existuje" }, { status: 400 });
      }
    }

    const updated = await prisma.iml_customers.update({
      where: { id },
      data: {
        name: String(name).trim(),
        email: email ? String(email).trim() : null,
        phone: phone ? String(phone).trim() : null,
        contact_person: contact_person ? String(contact_person).trim() : null,
        allow_under_over_delivery_percent: allow_under_over_delivery_percent != null ? parseFloat(allow_under_over_delivery_percent) : null,
        customer_note: customer_note ? String(customer_note).trim() : null,
        billing_address: billing_address ? String(billing_address).trim() : null,
        shipping_address: shipping_address ? String(shipping_address).trim() : null,
        individual_requirements: individual_requirements ? String(individual_requirements).trim() : null,
        city: city ? String(city).trim() : null,
        postal_code: postal_code ? String(postal_code).trim() : null,
        country: country ? String(country).trim() : "Česká republika",
      },
    });

    await logImlAudit({
      userId,
      action: "update",
      tableName: "iml_customers",
      recordId: id,
      oldValues: { name: existing.name, email: existing.email },
      newValues: { name: updated.name, email: updated.email },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("IML customers PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání zákazníka" }, { status: 500 });
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
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám IML" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.iml_customers.findUnique({
    where: { id },
    include: { iml_orders: { take: 1 } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Zákazník nenalezen" }, { status: 404 });
  }

  if (existing.iml_orders.length > 0) {
    return NextResponse.json(
      { error: "Zákazníka nelze smazat – má přiřazené objednávky" },
      { status: 400 }
    );
  }

  await prisma.iml_customers.delete({ where: { id } });

  await logImlAudit({
    userId,
    action: "delete",
    tableName: "iml_customers",
    recordId: id,
    oldValues: { name: existing.name, email: existing.email },
  });

  return NextResponse.json({ success: true });
}
