import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import {
  replaceProductColorsInTx,
  validateProductColorsInput,
  type IncomingProductColor,
} from "@/lib/iml-product-colors";

const productListSelect = {
  id: true,
  customer_id: true,
  ig_code: true,
  ig_short_name: true,
  client_code: true,
  client_name: true,
  requester: true,
  label_shape_code: true,
  product_format: true,
  die_cut_tool_code: true,
  assembly_code: true,
  positions_on_sheet: true,
  pieces_per_box: true,
  pieces_per_pallet: true,
  foil_id: true,
  foil_type: true,
  color_coverage: true,
  labels_per_sheet: true,
  print_note: true,
  has_print_sample: true,
  ean_code: true,
  production_notes: true,
  approval_status: true,
  realization_log: true,
  internal_note: true,
  last_edited_by: true,
  item_status: true,
  print_data_version: true,
  stock_quantity: true,
  sku: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  iml_customers: { select: { id: true, name: true } },
  iml_foils: { select: { id: true, code: true, name: true } },
} as const;

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
  const search = searchParams.get("search")?.trim() ?? "";
  const customerId = searchParams.get("customer_id");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { ig_code: { contains: search } },
      { ig_short_name: { contains: search } },
      { client_code: { contains: search } },
      { client_name: { contains: search } },
      { sku: { contains: search } },
    ];
  }
  if (customerId) {
    where.customer_id = parseInt(customerId, 10);
  }
  if (status) {
    where.item_status = status;
  }

  const products = await prisma.iml_products.findMany({
    where,
    orderBy: { id: "desc" },
    take: 200,
    select: {
      ...productListSelect,
      iml_customers: { select: { id: true, name: true } },
    },
  });

  // Efektivní flagy bez stahování blobů: jen OCTET_LENGTH > 0.
  let flagsById = new Map<number, { has_image: boolean; has_pdf: boolean }>();
  if (products.length > 0) {
    const ids = products.map((p) => p.id);
    const rows = await prisma.$queryRaw<
      Array<{ id: number; has_image: number; has_pdf: number }>
    >`
      SELECT id,
             CASE WHEN image_data IS NOT NULL AND OCTET_LENGTH(image_data) > 0 THEN 1 ELSE 0 END AS has_image,
             CASE WHEN pdf_data   IS NOT NULL AND OCTET_LENGTH(pdf_data)   > 0 THEN 1 ELSE 0 END AS has_pdf
      FROM iml_products
      WHERE id IN (${Prisma.join(ids)})
    `;
    flagsById = new Map(
      rows.map((r) => [
        Number(r.id),
        { has_image: Number(r.has_image) === 1, has_pdf: Number(r.has_pdf) === 1 },
      ])
    );
  }

  const productsWithFlags = products.map((p) => ({
    ...p,
    has_image: flagsById.get(p.id)?.has_image ?? false,
    has_pdf: flagsById.get(p.id)?.has_pdf ?? false,
  }));

  return NextResponse.json({ products: productsWithFlags });
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

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { first_name: true, last_name: true },
  });
  const editorName = user ? `${user.first_name} ${user.last_name}` : `user_${userId}`;

  try {
    const body = await req.json();
    const data = parseProductBody(body);

    if (data.sku) {
      const existing = await prisma.iml_products.findFirst({ where: { sku: data.sku } });
      if (existing) {
        return NextResponse.json({ error: "Produkt s tímto SKU již existuje" }, { status: 400 });
      }
    }

    const customDataForPrisma = data.custom_data;
    const createPayload = { ...data, custom_data: customDataForPrisma, last_edited_by: editorName };

    // Volitelné barvy – pokud jsou v body, uložíme je spolu s produktem v jedné transakci.
    const incomingColors = Array.isArray(body.colors)
      ? (body.colors as IncomingProductColor[])
      : null;
    const colorsValidation = incomingColors
      ? validateProductColorsInput(incomingColors)
      : null;
    if (colorsValidation && !colorsValidation.ok) {
      return NextResponse.json(
        { error: "Neplatné barvy", details: colorsValidation.details },
        { status: 400 }
      );
    }

    const productId = await prisma.$transaction(async (tx) => {
      const created = await tx.iml_products.create({
        data: createPayload as Parameters<typeof tx.iml_products.create>[0]["data"],
      });
      if (colorsValidation && colorsValidation.ok) {
        const res = await replaceProductColorsInTx(tx, created.id, colorsValidation.prepared, true);
        if (!res.ok) throw new Error(res.error);
      }
      return created.id;
    });

    const product = await prisma.iml_products.findUniqueOrThrow({
      where: { id: productId },
      select: { id: true, ig_code: true, client_name: true },
    });

    await logImlAudit({
      userId,
      action: "create",
      tableName: "iml_products",
      recordId: product.id,
      newValues: { ig_code: product.ig_code, client_name: product.client_name },
    });

    return NextResponse.json({ success: true, id: product.id });
  } catch (e) {
    console.error("IML products POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření produktu" }, { status: 500 });
  }
}

function parseProductBody(body: Record<string, unknown>) {
  const str = (v: unknown) => (v != null && v !== "" ? String(v).trim() : null);
  const int = (v: unknown) => (v != null && v !== "" ? parseInt(String(v), 10) : null);
  const num = (v: unknown) => (v != null && v !== "" ? parseFloat(String(v)) : null);

  return {
    customer_id: body.customer_id != null ? int(body.customer_id) : null,
    ig_code: str(body.ig_code),
    ig_short_name: str(body.ig_short_name),
    client_code: str(body.client_code),
    client_name: str(body.client_name),
    requester: str(body.requester),
    label_shape_code: str(body.label_shape_code),
    product_format: str(body.product_format),
    die_cut_tool_code: str(body.die_cut_tool_code),
    assembly_code: str(body.assembly_code),
    positions_on_sheet: int(body.positions_on_sheet),
    pieces_per_box: int(body.pieces_per_box),
    pieces_per_pallet: int(body.pieces_per_pallet),
    foil_id: body.foil_id != null ? int(body.foil_id) : null,
    foil_type: str(body.foil_type),
    color_coverage: str(body.color_coverage),
    labels_per_sheet: parseLabelsPerSheet(body.labels_per_sheet),
    print_note: str(body.print_note),
    has_print_sample: !!body.has_print_sample,
    ean_code: str(body.ean_code),
    production_notes: str(body.production_notes),
    approval_status: str(body.approval_status),
    realization_log: str(body.realization_log),
    internal_note: str(body.internal_note),
    item_status: str(body.item_status),
    print_data_version: str(body.print_data_version),
    stock_quantity: int(body.stock_quantity),
    sku: str(body.sku),
    is_active: body.is_active !== false,
    custom_data: parseCustomData(body.custom_data),
  };
}

/**
 * labels_per_sheet je povinně > 0 nebo NULL.
 * 0, prázdno, neplatný vstup → NULL (dle specifikace F3.4).
 */
function parseLabelsPerSheet(val: unknown): number | null {
  if (val == null || val === "") return null;
  const n = parseInt(String(val), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseCustomData(val: unknown): Record<string, unknown> | null {
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
