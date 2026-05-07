import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, type PrismaTransactionClient } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { hasImlSupervisorOverride } from "@/lib/iml-permissions";
import {
  parseOrderCustomData,
  resolveShippingSnapshot,
  validateOrderItemsProductStatus,
} from "@/lib/iml-order-utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k modulu IML" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customer_id");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (customerId) where.customer_id = parseInt(customerId, 10);
  if (status) where.status = status;

  const orders = await prisma.iml_orders.findMany({
    where,
    orderBy: { order_date: "desc" },
    take: 200,
    include: {
      iml_customers: { select: { id: true, name: true } },
      iml_order_items: {
        include: { iml_products: { select: { id: true, ig_code: true, ig_short_name: true, client_name: true } } },
      },
    },
  });

  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám IML" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      customer_id,
      order_number,
      order_date,
      status = "nová",
      notes,
      items,
      custom_data,
      shipping_address_id,
      supervisor_override: bodySupervisorOverride,
    } = body;

    if (!customer_id || !order_number || !order_date) {
      return NextResponse.json({ error: "Vyplňte zákazníka, číslo objednávky a datum" }, { status: 400 });
    }

    const customerId = parseInt(customer_id, 10);
    const orderDate = new Date(order_date);
    const shippingAddrRaw = shipping_address_id;
    const shippingAddrId =
      shippingAddrRaw != null && shippingAddrRaw !== ""
        ? parseInt(String(shippingAddrRaw), 10)
        : null;

    const existingOrder = await prisma.iml_orders.findFirst({
      where: { order_number: String(order_number).trim() },
    });
    if (existingOrder) {
      return NextResponse.json({ error: "Objednávka s tímto číslem již existuje" }, { status: 400 });
    }

    const customer = await prisma.iml_customers.findUnique({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json({ error: "Zákazník nenalezen" }, { status: 400 });
    }

    const orderItemsRaw = Array.isArray(items) ? items : [];
    const normalizedItems: { product_id: number; quantity: number; unit_price: number | null }[] = [];
    for (const it of orderItemsRaw) {
      const productId = parseInt(it.product_id, 10);
      const quantity = parseInt(it.quantity, 10) || 0;
      if (!productId || quantity <= 0) continue;
      const unitPrice = it.unit_price != null ? parseFloat(String(it.unit_price)) : null;
      normalizedItems.push({ product_id: productId, quantity, unit_price: unitPrice });
    }

    const allowNonActive =
      bodySupervisorOverride === true && (await hasImlSupervisorOverride(userId));

    let totalSum = 0;

    const order = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const statusCheck = await validateOrderItemsProductStatus(tx, normalizedItems, allowNonActive);
      if (!statusCheck.ok) {
        throw Object.assign(new Error("IML_ORDER_ITEM_STATUS"), {
          code: 409,
          product_id: statusCheck.product_id,
          item_status: statusCheck.item_status,
        });
      }

      const snap = await resolveShippingSnapshot(tx, customerId, shippingAddrId);

      const ord = await tx.iml_orders.create({
        data: {
          customer_id: customerId,
          order_number: String(order_number).trim(),
          order_date: orderDate,
          status: String(status).trim() || "nová",
          notes: notes ? String(notes).trim() : null,
          total: null,
          custom_data: (parseOrderCustomData(custom_data) ?? null) as Parameters<
            typeof prisma.iml_orders.create
          >[0]["data"]["custom_data"],
          ...snap,
        },
      });

      for (const row of normalizedItems) {
        const product = await tx.iml_products.findUnique({ where: { id: row.product_id } });
        if (!product) continue;

        const subtotal = row.unit_price != null ? row.unit_price * row.quantity : null;
        if (subtotal) totalSum += subtotal;

        await tx.iml_order_items.create({
          data: {
            order_id: ord.id,
            product_id: row.product_id,
            quantity: row.quantity,
            unit_price: row.unit_price,
            subtotal: subtotal,
          },
        });
      }

      return tx.iml_orders.update({
        where: { id: ord.id },
        data: { total: totalSum > 0 ? totalSum : null },
      });
    });

    await logImlAudit({
      userId,
      action: "create",
      tableName: "iml_orders",
      recordId: order.id,
      newValues: { order_number: order.order_number, customer_id: customerId },
    });

    return NextResponse.json({ success: true, id: order.id });
  } catch (e) {
    if (e && typeof e === "object" && (e as Error).message === "IML_ORDER_ITEM_STATUS") {
      const x = e as { code?: number; product_id?: number; item_status?: string | null };
      return NextResponse.json(
        {
          error:
            "Objednávka obsahuje produkt, který není ve stavu „aktivní“. Potvrďte výjimku supervizorem nebo odeberte řádek.",
          field: "items",
          product_id: x.product_id,
          item_status: x.item_status,
        },
        { status: 409 }
      );
    }
    console.error("IML orders POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření objednávky" }, { status: 500 });
  }
}
