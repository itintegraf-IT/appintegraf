import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { normalizeAddressInput } from "@/lib/iml-shipping";

type RouteParams = { params: Promise<{ id: string; addressId: string }> };

async function resolveIds(params: RouteParams["params"]) {
  const raw = await params;
  const customerId = parseInt(raw.id, 10);
  const addressId = parseInt(raw.addressId, 10);
  return { customerId, addressId };
}

/**
 * GET /api/iml/customers/[id]/shipping-addresses/[addressId]
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k modulu IML" }, { status: 403 });
  }

  const { customerId, addressId } = await resolveIds(params);
  if (isNaN(customerId) || isNaN(addressId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const address = await prisma.iml_customer_shipping_addresses.findFirst({
    where: { id: addressId, customer_id: customerId },
  });
  if (!address) {
    return NextResponse.json({ error: "Adresa nenalezena" }, { status: 404 });
  }

  return NextResponse.json({ address });
}

/**
 * PUT /api/iml/customers/[id]/shipping-addresses/[addressId]
 * Pokud nově is_default=true a dříve nebylo, atomicky vypne výchozí u ostatních adres.
 * Pokud se is_default mění z true→false a je to jediná výchozí, vyžaduje výběr jiné
 * (400 – chráníme invariant "max. 1 výchozí adresa, pokud jich je víc").
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám IML" }, { status: 403 });
  }

  const { customerId, addressId } = await resolveIds(params);
  if (isNaN(customerId) || isNaN(addressId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.iml_customer_shipping_addresses.findFirst({
    where: { id: addressId, customer_id: customerId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Adresa nenalezena" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const data = normalizeAddressInput(body);

    if (existing.is_default && !data.is_default) {
      const otherCount = await prisma.iml_customer_shipping_addresses.count({
        where: { customer_id: customerId, NOT: { id: addressId } },
      });
      if (otherCount > 0) {
        return NextResponse.json(
          { error: "Tato adresa je výchozí – nelze zrušit výchozí bez určení jiné. Nastavte jinou adresu jako výchozí." },
          { status: 400 }
        );
      }
      data.is_default = true;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (data.is_default && !existing.is_default) {
        await tx.iml_customer_shipping_addresses.updateMany({
          where: { customer_id: customerId, is_default: true, NOT: { id: addressId } },
          data: { is_default: false },
        });
      }
      return tx.iml_customer_shipping_addresses.update({
        where: { id: addressId },
        data: {
          label: data.label,
          recipient: data.recipient,
          street: data.street,
          city: data.city,
          postal_code: data.postal_code,
          country: data.country ?? "Česká republika",
          is_default: data.is_default,
          label_requirements: data.label_requirements,
          pallet_packaging: data.pallet_packaging,
          prepress_notes: data.prepress_notes,
        },
      });
    });

    await logImlAudit({
      userId,
      action: "update",
      tableName: "iml_customer_shipping_addresses",
      recordId: updated.id,
      oldValues: {
        label: existing.label,
        street: existing.street,
        city: existing.city,
        is_default: existing.is_default,
      },
      newValues: {
        label: updated.label,
        street: updated.street,
        city: updated.city,
        is_default: updated.is_default,
      },
    });

    return NextResponse.json({ success: true, address: updated });
  } catch (e) {
    console.error("IML shipping-addresses PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání adresy" }, { status: 500 });
  }
}

/**
 * DELETE /api/iml/customers/[id]/shipping-addresses/[addressId]
 * Pokud mažeme výchozí adresu a existují další, přeneseme výchozí na nejstarší z nich.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám IML" }, { status: 403 });
  }

  const { customerId, addressId } = await resolveIds(params);
  if (isNaN(customerId) || isNaN(addressId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.iml_customer_shipping_addresses.findFirst({
    where: { id: addressId, customer_id: customerId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Adresa nenalezena" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.iml_customer_shipping_addresses.delete({ where: { id: addressId } });
      if (existing.is_default) {
        const next = await tx.iml_customer_shipping_addresses.findFirst({
          where: { customer_id: customerId },
          orderBy: { created_at: "asc" },
          select: { id: true },
        });
        if (next) {
          await tx.iml_customer_shipping_addresses.update({
            where: { id: next.id },
            data: { is_default: true },
          });
        }
      }
    });

    await logImlAudit({
      userId,
      action: "delete",
      tableName: "iml_customer_shipping_addresses",
      recordId: addressId,
      oldValues: {
        customer_id: customerId,
        label: existing.label,
        street: existing.street,
        is_default: existing.is_default,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("IML shipping-addresses DELETE error:", e);
    return NextResponse.json({ error: "Chyba při mazání adresy" }, { status: 500 });
  }
}
