import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { normalizeAddressInput } from "@/lib/iml-shipping";

/**
 * GET /api/iml/customers/[id]/shipping-addresses
 * Vrátí seznam doručovacích adres zákazníka. Výchozí (is_default=true) jako první.
 */
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

  const customerId = parseInt((await params).id, 10);
  if (isNaN(customerId)) {
    return NextResponse.json({ error: "Neplatné ID zákazníka" }, { status: 400 });
  }

  const customerExists = await prisma.iml_customers.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customerExists) {
    return NextResponse.json({ error: "Zákazník nenalezen" }, { status: 404 });
  }

  const addresses = await prisma.iml_customer_shipping_addresses.findMany({
    where: { customer_id: customerId },
    orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
  });

  return NextResponse.json({ addresses });
}

/**
 * POST /api/iml/customers/[id]/shipping-addresses
 * Vytvoří novou doručovací adresu. Pokud is_default=true, atomicky přepne všechny ostatní
 * adresy tohoto zákazníka na is_default=false.
 * Pokud je to první adresa zákazníka, je automaticky nastavena jako výchozí.
 */
export async function POST(
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

  const customerId = parseInt((await params).id, 10);
  if (isNaN(customerId)) {
    return NextResponse.json({ error: "Neplatné ID zákazníka" }, { status: 400 });
  }

  const customerExists = await prisma.iml_customers.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customerExists) {
    return NextResponse.json({ error: "Zákazník nenalezen" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const data = normalizeAddressInput(body);

    const existingCount = await prisma.iml_customer_shipping_addresses.count({
      where: { customer_id: customerId },
    });
    const shouldBeDefault = Boolean(data.is_default) || existingCount === 0;

    const created = await prisma.$transaction(async (tx) => {
      if (shouldBeDefault && existingCount > 0) {
        await tx.iml_customer_shipping_addresses.updateMany({
          where: { customer_id: customerId, is_default: true },
          data: { is_default: false },
        });
      }
      return tx.iml_customer_shipping_addresses.create({
        data: {
          customer_id: customerId,
          label: data.label,
          recipient: data.recipient,
          street: data.street,
          city: data.city,
          postal_code: data.postal_code,
          country: data.country ?? "Česká republika",
          is_default: shouldBeDefault,
          label_requirements: data.label_requirements,
          pallet_packaging: data.pallet_packaging,
          prepress_notes: data.prepress_notes,
        },
      });
    });

    await logImlAudit({
      userId,
      action: "create",
      tableName: "iml_customer_shipping_addresses",
      recordId: created.id,
      newValues: {
        customer_id: customerId,
        label: created.label,
        recipient: created.recipient,
        street: created.street,
        city: created.city,
        is_default: created.is_default,
      },
    });

    return NextResponse.json({ success: true, id: created.id, address: created });
  } catch (e) {
    console.error("IML shipping-addresses POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření adresy" }, { status: 500 });
  }
}

