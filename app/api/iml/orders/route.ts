import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, type PrismaTransactionClient } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";

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
    const { customer_id, order_number, order_date, status = "nová", notes, items, custom_data } = body;

    if (!customer_id || !order_number || !order_date) {
      return NextResponse.json({ error: "Vyplňte zákazníka, číslo objednávky a datum" }, { status: 400 });
    }

    const customerId = parseInt(customer_id, 10);
    const orderDate = new Date(order_date);

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

    const orderItems = Array.isArray(items) ? items : [];
    let totalSum = 0;

    const order = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
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
        },
      });

      for (const it of orderItems) {
        const productId = parseInt(it.product_id, 10);
        const quantity = parseInt(it.quantity, 10) || 0;
        if (!productId || quantity <= 0) continue;

        const product = await tx.iml_products.findUnique({ where: { id: productId } });
        if (!product) continue;

        const unitPrice = it.unit_price != null ? parseFloat(it.unit_price) : null;
        const subtotal = unitPrice != null ? unitPrice * quantity : null;
        if (subtotal) totalSum += subtotal;

        await tx.iml_order_items.create({
          data: {
            order_id: ord.id,
            product_id: productId,
            quantity,
            unit_price: unitPrice,
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
    console.error("IML orders POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření objednávky" }, { status: 500 });
  }
}

function parseOrderCustomData(val: unknown): Record<string, unknown> | null {
  if (val == null) return null;
  if (typeof val === "object" && !Array.isArray(val)) {
    const obj = val as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof k === "string" && /^[a-z0-9_]+$/.test(k)) {
        if (v === null || v === undefined || v === "") continue;
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") clean[k] = v;
        else if (v instanceof Date) clean[k] = v.toISOString().slice(0, 10);
      }
    }
    return Object.keys(clean).length > 0 ? clean : null;
  }
  return null;
}
