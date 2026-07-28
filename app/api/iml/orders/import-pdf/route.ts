import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, type PrismaTransactionClient } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { extractTextFromPdfBuffer } from "@/lib/contracts/extract-text-from-pdf";
import {
  ORDER_PDF_TEMPLATES,
  resolveOrderPdfTemplate,
} from "@/lib/iml/order-pdf/registry";

/**
 * Import objednávky IML z PDF.
 * - multipart/form-data (file + template) → náhled: rozparsovaná hlavička, položky
 *   se spárovanými produkty (client_code → ig_code) a návrh zákazníka
 * - application/json → vytvoření objednávky z potvrzeného náhledu
 */

type PreviewItem = {
  itemNo: string;
  description: string;
  customerMaterialNo: string | null;
  yourMaterialNo: string | null;
  quantity: number | null;
  price: number | null;
  priceBasis: number;
  netAmount: number | null;
  deliveryDate: string | null;
  productId: number | null;
  productLabel: string | null;
  matchedBy: "client_code" | "ig_code" | null;
};

async function handlePreview(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const templateKey = String(formData.get("template") ?? "auto");

  if (!file?.size) {
    return NextResponse.json({ error: "Žádný soubor" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { text } = await extractTextFromPdfBuffer(buffer);
  if (!text) {
    return NextResponse.json(
      { error: "Z PDF se nepodařilo vytěžit text (naskenovaný dokument bez textové vrstvy?)" },
      { status: 400 }
    );
  }

  const template = resolveOrderPdfTemplate(templateKey, text);
  if (!template) {
    return NextResponse.json(
      {
        error: `Nepodařilo se rozpoznat formát PDF. Dostupné šablony: ${ORDER_PDF_TEMPLATES.map((t) => t.label).join(", ")}`,
      },
      { status: 400 }
    );
  }

  const parsed = template.parse(text);
  const warnings = [...parsed.warnings];

  const duplicate = parsed.orderNumber
    ? (await prisma.iml_orders.findFirst({
        where: { order_number: parsed.orderNumber },
        select: { id: true },
      })) != null
    : false;
  if (duplicate) {
    warnings.push(`Objednávka "${parsed.orderNumber}" již v systému existuje.`);
  }

  const suggestedCustomer = await prisma.iml_customers.findFirst({
    where: { name: { contains: template.customerHint } },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

  const products = await prisma.iml_products.findMany({
    where: {
      OR: [{ client_code: { not: null } }, { ig_code: { not: null } }],
    },
    select: {
      id: true,
      ig_code: true,
      client_code: true,
      client_name: true,
      ig_short_name: true,
      customer_id: true,
    },
  });
  type ProductRow = (typeof products)[number];
  const byClientCode = new Map<string, ProductRow>();
  const byIgCode = new Map<string, ProductRow>();
  for (const p of products) {
    if (p.client_code) byClientCode.set(p.client_code.trim().toLowerCase(), p);
    if (p.ig_code) byIgCode.set(p.ig_code.trim().toLowerCase(), p);
  }

  const productLabel = (p: ProductRow) =>
    `${p.ig_code ?? `#${p.id}`} — ${p.client_name ?? p.ig_short_name ?? "Bez názvu"}`;

  const items: PreviewItem[] = parsed.items.map((it) => {
    let matched: ProductRow | undefined;
    let matchedBy: PreviewItem["matchedBy"] = null;
    if (it.customerMaterialNo) {
      matched = byClientCode.get(it.customerMaterialNo.trim().toLowerCase());
      if (matched) matchedBy = "client_code";
    }
    if (!matched && it.yourMaterialNo) {
      matched = byIgCode.get(it.yourMaterialNo.trim().toLowerCase());
      if (matched) matchedBy = "ig_code";
    }
    if (!matched) {
      warnings.push(
        `Položka ${it.itemNo} (${it.description}): produkt nenalezen podle kódu klienta` +
          `${it.customerMaterialNo ? ` "${it.customerMaterialNo}"` : ""}` +
          `${it.yourMaterialNo ? ` ani kódu IG "${it.yourMaterialNo}"` : ""}.`
      );
    }
    return {
      ...it,
      productId: matched?.id ?? null,
      productLabel: matched ? productLabel(matched) : null,
      matchedBy,
    };
  });

  const deliveryDates = parsed.items
    .map((it) => it.deliveryDate)
    .filter((d): d is string => !!d)
    .sort();

  return NextResponse.json({
    template: template.key,
    order: {
      orderNumber: parsed.orderNumber,
      orderDate: parsed.orderDate,
      expectedShipDate: deliveryDates[0] ?? null,
      currency: parsed.currency,
      notes: parsed.notes,
      totalAmount: parsed.totalAmount,
    },
    duplicate,
    suggestedCustomer,
    items,
    warnings,
  });
}

type ImportItemBody = {
  product_id: number;
  quantity: number;
  unit_price?: number | null;
  subtotal?: number | null;
};

async function handleImport(req: NextRequest, userId: number): Promise<NextResponse> {
  const body = await req.json();
  const orderNumber = String(body.order_number ?? "").trim();
  const customerId = parseInt(String(body.customer_id ?? ""), 10);
  const orderDateRaw = String(body.order_date ?? "").trim();
  const expectedShipRaw = String(body.expected_ship_date ?? "").trim();
  const notes = body.notes ? String(body.notes).trim() : null;
  const status = String(body.status ?? "nová").trim() || "nová";
  const itemsRaw: ImportItemBody[] = Array.isArray(body.items) ? body.items : [];

  if (!orderNumber || !customerId || !orderDateRaw) {
    return NextResponse.json(
      { error: "Vyplňte číslo objednávky, zákazníka a datum" },
      { status: 400 }
    );
  }
  const orderDate = new Date(orderDateRaw);
  if (Number.isNaN(orderDate.getTime())) {
    return NextResponse.json({ error: "Neplatné datum objednávky" }, { status: 400 });
  }
  const expectedShipDate = expectedShipRaw ? new Date(expectedShipRaw) : null;
  if (expectedShipDate && Number.isNaN(expectedShipDate.getTime())) {
    return NextResponse.json({ error: "Neplatné datum expedice" }, { status: 400 });
  }

  const items = itemsRaw
    .map((it) => ({
      product_id: parseInt(String(it.product_id), 10),
      quantity: parseInt(String(it.quantity), 10),
      unit_price: it.unit_price != null ? Number(it.unit_price) : null,
      subtotal: it.subtotal != null ? Number(it.subtotal) : null,
    }))
    .filter((it) => it.product_id > 0);

  if (items.length === 0) {
    return NextResponse.json({ error: "Objednávka nemá žádné položky" }, { status: 400 });
  }
  if (items.some((it) => !Number.isFinite(it.quantity) || it.quantity <= 0)) {
    return NextResponse.json(
      { error: "Každá položka musí mít množství větší než 0" },
      { status: 400 }
    );
  }

  const existing = await prisma.iml_orders.findFirst({ where: { order_number: orderNumber } });
  if (existing) {
    return NextResponse.json(
      { error: `Objednávka "${orderNumber}" již existuje` },
      { status: 409 }
    );
  }

  const customer = await prisma.iml_customers.findUnique({ where: { id: customerId } });
  if (!customer) {
    return NextResponse.json({ error: "Zákazník nenalezen" }, { status: 400 });
  }

  const productIds = items.map((it) => it.product_id);
  const foundProducts = await prisma.iml_products.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
  });
  const foundIds = new Set(foundProducts.map((p) => p.id));
  const missing = productIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Produkty nenalezeny: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  let totalSum = 0;
  const order = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const o = await tx.iml_orders.create({
      data: {
        customer_id: customerId,
        order_number: orderNumber,
        order_date: orderDate,
        expected_ship_date: expectedShipDate,
        status,
        notes,
        total: null,
      },
    });

    for (const it of items) {
      // Mezisoučet přesně z PDF (Net Amount); cena/ks jen orientačně zaokrouhlená.
      const subtotal =
        it.subtotal != null && Number.isFinite(it.subtotal)
          ? it.subtotal
          : it.unit_price != null
            ? it.unit_price * it.quantity
            : null;
      if (subtotal) totalSum += subtotal;
      await tx.iml_order_items.create({
        data: {
          order_id: o.id,
          product_id: it.product_id,
          quantity: it.quantity,
          unit_price: it.unit_price,
          subtotal,
        },
      });
    }

    return tx.iml_orders.update({
      where: { id: o.id },
      data: { total: totalSum > 0 ? totalSum : null },
    });
  });

  await logImlAudit({
    userId,
    action: "create",
    tableName: "iml_orders",
    recordId: order.id,
    newValues: { order_number: order.order_number, customer_id: customerId, source: "pdf-import" },
  });

  return NextResponse.json({ success: true, id: order.id, order_number: order.order_number });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění importovat objednávky" }, { status: 403 });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      return await handlePreview(req);
    }
    return await handleImport(req, userId);
  } catch (e) {
    console.error("IML orders PDF import error:", e);
    return NextResponse.json({ error: "Chyba při importu PDF" }, { status: 500 });
  }
}
