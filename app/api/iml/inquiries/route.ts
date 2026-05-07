import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, type PrismaTransactionClient } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { parseOrderCustomData } from "@/lib/iml-order-utils";

function genInquiryNumber(): string {
  const d = new Date();
  const y = d.getFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `PO-${y}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${d.getTime().toString(36).toUpperCase()}`;
}

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
  const search = searchParams.get("search")?.trim() ?? "";

  const where: Record<string, unknown> = {};
  if (customerId) where.customer_id = parseInt(customerId, 10);
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { inquiry_number: { contains: search } },
      { notes: { contains: search } },
    ];
  }

  const inquiries = await prisma.iml_inquiries.findMany({
    where,
    orderBy: { inquiry_date: "desc" },
    take: 300,
    include: {
      iml_customers: { select: { id: true, name: true } },
      iml_inquiry_items: { select: { id: true } },
    },
  });

  const list = inquiries.map(({ iml_inquiry_items, ...rest }) => ({
    ...rest,
    items_count: iml_inquiry_items.length,
  }));

  return NextResponse.json({ inquiries: list });
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
      inquiry_number: rawNumber,
      inquiry_date,
      status = "nová",
      notes,
      items,
      custom_data,
    } = body;

    if (!customer_id || !inquiry_date) {
      return NextResponse.json({ error: "Vyplňte zákazníka a datum poptávky" }, { status: 400 });
    }

    const customerId = parseInt(customer_id, 10);
    const customer = await prisma.iml_customers.findUnique({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json({ error: "Zákazník nenalezen" }, { status: 400 });
    }

    let inquiryNumber = rawNumber ? String(rawNumber).trim() : genInquiryNumber();
    if (!inquiryNumber) inquiryNumber = genInquiryNumber();

    const exists = await prisma.iml_inquiries.findFirst({
      where: { inquiry_number: inquiryNumber },
    });
    if (exists) {
      return NextResponse.json({ error: "Poptávka s tímto číslem již existuje" }, { status: 400 });
    }

    const inquiryItems = Array.isArray(items) ? items : [];

    const inquiry = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const created = await tx.iml_inquiries.create({
        data: {
          customer_id: customerId,
          inquiry_number: inquiryNumber,
          inquiry_date: new Date(inquiry_date),
          status: String(status).trim() || "nová",
          notes: notes ? String(notes).trim() : null,
          custom_data: (parseOrderCustomData(custom_data) ?? null) as Parameters<
            typeof tx.iml_inquiries.create
          >[0]["data"]["custom_data"],
        },
      });

      for (const it of inquiryItems) {
        const productId = parseInt(String(it.product_id), 10);
        const quantity = parseInt(String(it.quantity), 10) || 0;
        if (!productId || quantity <= 0) continue;

        const product = await tx.iml_products.findUnique({ where: { id: productId } });
        if (!product) continue;

        const unitPrice = it.unit_price != null ? parseFloat(String(it.unit_price)) : null;
        const subtotal = unitPrice != null ? unitPrice * quantity : null;

        await tx.iml_inquiry_items.create({
          data: {
            inquiry_id: created.id,
            product_id: productId,
            quantity,
            unit_price: unitPrice,
            subtotal,
          },
        });
      }

      return created;
    });

    await logImlAudit({
      userId,
      action: "create",
      tableName: "iml_inquiries",
      recordId: inquiry.id,
      newValues: { inquiry_number: inquiry.inquiry_number, customer_id: customerId },
    });

    return NextResponse.json({ success: true, id: inquiry.id });
  } catch (e) {
    console.error("IML inquiries POST:", e);
    return NextResponse.json({ error: "Chyba při vytváření poptávky" }, { status: 500 });
  }
}
