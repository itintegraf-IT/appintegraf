import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma, type PrismaTransactionClient } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { parseOrderCustomData } from "@/lib/iml-order-utils";

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

  const inquiry = await prisma.iml_inquiries.findUnique({
    where: { id },
    include: {
      iml_customers: true,
      iml_inquiry_items: {
        include: {
          iml_products: {
            select: {
              id: true,
              ig_code: true,
              ig_short_name: true,
              client_name: true,
              item_status: true,
              stock_quantity: true,
            },
          },
        },
      },
      iml_orders: { select: { id: true, order_number: true, order_date: true, status: true } },
    },
  });

  if (!inquiry) {
    return NextResponse.json({ error: "Poptávka nenalezena" }, { status: 404 });
  }

  return NextResponse.json(inquiry);
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

  const existing = await prisma.iml_inquiries.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Poptávka nenalezena" }, { status: 404 });
  }

  if (existing.converted_order_id) {
    return NextResponse.json(
      { error: "Překlopenou poptávku nelze upravovat" },
      { status: 409 }
    );
  }

  try {
    const body = await req.json();
    const { inquiry_date, status, notes, items, custom_data } = body;

    const nextDate = inquiry_date ? new Date(inquiry_date) : existing.inquiry_date;
    const nextStatus = status != null ? String(status).trim() : existing.status;
    const nextNotes = notes !== undefined ? (notes ? String(notes).trim() : null) : existing.notes;
    const parsedCustom =
      custom_data !== undefined ? parseOrderCustomData(custom_data) : undefined;

    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      await tx.iml_inquiries.update({
        where: { id },
        data: {
          inquiry_date: nextDate,
          status: nextStatus,
          notes: nextNotes,
          ...(parsedCustom !== undefined
            ? {
                custom_data:
                  parsedCustom === null
                    ? Prisma.DbNull
                    : (parsedCustom as Prisma.InputJsonValue),
              }
            : {}),
        },
      });

      if (Array.isArray(items)) {
        await tx.iml_inquiry_items.deleteMany({ where: { inquiry_id: id } });

        for (const it of items) {
          const productId = parseInt(String(it.product_id), 10);
          const quantity = parseInt(String(it.quantity), 10) || 0;
          if (!productId || quantity <= 0) continue;

          const product = await tx.iml_products.findUnique({ where: { id: productId } });
          if (!product) continue;

          const unitPrice = it.unit_price != null ? parseFloat(String(it.unit_price)) : null;
          const subtotal = unitPrice != null ? unitPrice * quantity : null;

          await tx.iml_inquiry_items.create({
            data: {
              inquiry_id: id,
              product_id: productId,
              quantity,
              unit_price: unitPrice,
              subtotal,
            },
          });
        }
      }
    });

    await logImlAudit({
      userId,
      action: "update",
      tableName: "iml_inquiries",
      recordId: id,
      oldValues: { inquiry_number: existing.inquiry_number, status: existing.status },
      newValues: { inquiry_number: existing.inquiry_number, status: nextStatus },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("IML inquiries PUT:", e);
    return NextResponse.json({ error: "Chyba při ukládání poptávky" }, { status: 500 });
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

  const existing = await prisma.iml_inquiries.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Poptávka nenalezena" }, { status: 404 });
  }

  if (existing.converted_order_id) {
    return NextResponse.json(
      { error: "Překlopenou poptávku nelze smazat" },
      { status: 409 }
    );
  }

  await prisma.iml_inquiry_items.deleteMany({ where: { inquiry_id: id } });
  await prisma.iml_inquiries.delete({ where: { id } });

  await logImlAudit({
    userId,
    action: "delete",
    tableName: "iml_inquiries",
    recordId: id,
    oldValues: { inquiry_number: existing.inquiry_number },
  });

  return NextResponse.json({ success: true });
}
