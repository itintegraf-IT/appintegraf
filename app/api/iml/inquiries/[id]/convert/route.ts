import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, type PrismaTransactionClient } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { parseOrderCustomData, resolveShippingSnapshot } from "@/lib/iml-order-utils";

/**
 * Překlopí poptávku do objednávky. Idempotentní: opakované volání vrátí 409.
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

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const inquiry = await prisma.iml_inquiries.findUnique({
    where: { id },
    include: { iml_inquiry_items: true },
  });

  if (!inquiry) {
    return NextResponse.json({ error: "Poptávka nenalezena" }, { status: 404 });
  }

  if (inquiry.converted_order_id) {
    return NextResponse.json(
      {
        error: "Poptávka již byla překlopena",
        order_id: inquiry.converted_order_id,
      },
      { status: 409 }
    );
  }

  try {
    const body = await req.json();
    const {
      order_number,
      order_date,
      status = "nová",
      notes,
      shipping_address_id,
      custom_data,
    } = body;

    if (!order_number || !String(order_number).trim()) {
      return NextResponse.json({ error: "Vyplňte číslo objednávky" }, { status: 400 });
    }

    const ordNum = String(order_number).trim();
    const dup = await prisma.iml_orders.findFirst({ where: { order_number: ordNum } });
    if (dup) {
      return NextResponse.json({ error: "Objednávka s tímto číslem již existuje" }, { status: 400 });
    }

    const orderDate = order_date ? new Date(order_date) : new Date();
    const orderNotes =
      notes != null && String(notes).trim()
        ? String(notes).trim()
        : inquiry.notes
          ? `Z poptávky ${inquiry.inquiry_number}: ${inquiry.notes}`
          : `Z poptávky ${inquiry.inquiry_number}`;

    const mergedCustom =
      parseOrderCustomData(custom_data) ??
      (inquiry.custom_data && typeof inquiry.custom_data === "object"
        ? (inquiry.custom_data as Record<string, unknown>)
        : null);

    const orderId = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const snap = await resolveShippingSnapshot(
        tx,
        inquiry.customer_id,
        shipping_address_id != null ? parseInt(String(shipping_address_id), 10) : null
      );

      let totalSum = 0;
      const ord = await tx.iml_orders.create({
        data: {
          customer_id: inquiry.customer_id,
          order_number: ordNum,
          order_date: orderDate,
          status: String(status).trim() || "nová",
          notes: orderNotes,
          total: null,
          custom_data: mergedCustom as Parameters<typeof tx.iml_orders.create>[0]["data"]["custom_data"],
          inquiry_id: inquiry.id,
          ...snap,
        },
      });

      for (const it of inquiry.iml_inquiry_items) {
        const unitPrice = it.unit_price != null ? Number(it.unit_price) : null;
        const subtotal = it.subtotal != null ? Number(it.subtotal) : null;
        if (subtotal) totalSum += subtotal;

        await tx.iml_order_items.create({
          data: {
            order_id: ord.id,
            product_id: it.product_id,
            quantity: it.quantity,
            unit_price: unitPrice,
            subtotal: subtotal,
          },
        });
      }

      await tx.iml_orders.update({
        where: { id: ord.id },
        data: { total: totalSum > 0 ? totalSum : null },
      });

      await tx.iml_inquiries.update({
        where: { id: inquiry.id },
        data: {
          status: "překlopená",
          converted_order_id: ord.id,
        },
      });

      return ord.id;
    });

    await logImlAudit({
      userId,
      action: "update",
      tableName: "iml_inquiries",
      recordId: inquiry.id,
      oldValues: { inquiry_number: inquiry.inquiry_number, converted_order_id: null },
      newValues: { inquiry_number: inquiry.inquiry_number, converted_order_id: orderId },
    });

    await logImlAudit({
      userId,
      action: "create",
      tableName: "iml_orders",
      recordId: orderId,
      newValues: { order_number: ordNum, from_inquiry: inquiry.inquiry_number },
    });

    return NextResponse.json({ success: true, order_id: orderId });
  } catch (e) {
    console.error("IML inquiry convert:", e);
    return NextResponse.json({ error: "Chyba při překlopení poptávky" }, { status: 500 });
  }
}
