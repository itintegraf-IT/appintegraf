import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma, type PrismaTransactionClient } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { hasImlSupervisorOverride } from "@/lib/iml-permissions";
import { parseOrderCustomData, validateOrderItemsProductStatus } from "@/lib/iml-order-utils";

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

  const order = await prisma.iml_orders.findUnique({
    where: { id },
    include: {
      iml_customers: true,
      iml_order_items: {
        include: { iml_products: { select: { id: true, ig_code: true, ig_short_name: true, client_name: true } } },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Objednávka nenalezena" }, { status: 404 });
  }

  return NextResponse.json(order);
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

  const existing = await prisma.iml_orders.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Objednávka nenalezena" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { order_date, status, notes, items, custom_data, supervisor_override: bodySupervisorOverride } =
      body;

    const orderDate = order_date ? new Date(order_date) : existing.order_date;
    const newStatus = status != null ? String(status).trim() : existing.status;
    const newNotes = notes != null ? (notes ? String(notes).trim() : null) : existing.notes;
    const parsedCustom = custom_data !== undefined ? parseOrderCustomData(custom_data) : undefined;

    const updateData: Prisma.iml_ordersUpdateInput = {
      order_date: orderDate,
      status: newStatus,
      notes: newNotes,
    };
    if (parsedCustom !== undefined) {
      updateData.custom_data =
        parsedCustom === null ? Prisma.DbNull : (parsedCustom as Prisma.InputJsonValue);
    }

    const allowNonActive =
      bodySupervisorOverride === true && (await hasImlSupervisorOverride(userId));

    let totalSum = 0;

    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      if (Array.isArray(items)) {
        const normalizedItems: { product_id: number; quantity: number; unit_price: number | null }[] = [];
        for (const it of items) {
          const productId = parseInt(it.product_id, 10);
          const quantity = parseInt(it.quantity, 10) || 0;
          if (!productId || quantity <= 0) continue;
          const unitPrice = it.unit_price != null ? parseFloat(String(it.unit_price)) : null;
          normalizedItems.push({ product_id: productId, quantity, unit_price: unitPrice });
        }

        const statusCheck = await validateOrderItemsProductStatus(
          tx,
          normalizedItems,
          allowNonActive
        );
        if (!statusCheck.ok) {
          throw Object.assign(new Error("IML_ORDER_ITEM_STATUS"), {
            code: 409,
            product_id: statusCheck.product_id,
            item_status: statusCheck.item_status,
          });
        }

        await tx.iml_order_items.deleteMany({ where: { order_id: id } });

        for (const row of normalizedItems) {
          const product = await tx.iml_products.findUnique({ where: { id: row.product_id } });
          if (!product) continue;

          const subtotal = row.unit_price != null ? row.unit_price * row.quantity : null;
          if (subtotal) totalSum += subtotal;

          await tx.iml_order_items.create({
            data: {
              order_id: id,
              product_id: row.product_id,
              quantity: row.quantity,
              unit_price: row.unit_price,
              subtotal: subtotal,
            },
          });
        }

        updateData.total = totalSum > 0 ? totalSum : null;
      }

      await tx.iml_orders.update({
        where: { id },
        data: updateData,
      });
    });

    await logImlAudit({
      userId,
      action: "update",
      tableName: "iml_orders",
      recordId: id,
      oldValues: { order_number: existing.order_number, status: existing.status },
      newValues: { order_number: existing.order_number, status: newStatus },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e && typeof e === "object" && (e as Error).message === "IML_ORDER_ITEM_STATUS") {
      const x = e as { product_id?: number; item_status?: string | null };
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
    console.error("IML orders PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání objednávky" }, { status: 500 });
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

  const existing = await prisma.iml_orders.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Objednávka nenalezena" }, { status: 404 });
  }

  await prisma.iml_order_items.deleteMany({ where: { order_id: id } });
  await prisma.iml_orders.delete({ where: { id } });

  await logImlAudit({
    userId,
    action: "delete",
    tableName: "iml_orders",
    recordId: id,
    oldValues: { order_number: existing.order_number },
  });

  return NextResponse.json({ success: true });
}
