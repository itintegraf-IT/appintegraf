import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { resolveCatalogCustomerId } from "@/lib/iml-customer-catalog";
import {
  replaceProductColorsInTx,
  validateProductColorsInput,
  type IncomingProductColor,
} from "@/lib/iml-product-colors";
import { parseImlProductBodyForSave } from "@/lib/iml/parse-product-body";
import { applyPrintColorsSummaryOnSave } from "@/lib/iml-product-save-colors";
import {
  imlProductColorsReplaceErrorResponse,
  imlProductSaveErrorResponse,
} from "@/lib/iml-product-save-errors";
import { toImlProductCreateData } from "@/lib/iml/product-prisma-payload";

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
  format_width_mm: true,
  format_height_mm: true,
  die_cut_tool_code: true,
  assembly_code: true,
  positions_on_sheet: true,
  pieces_per_box: true,
  pieces_per_pallet: true,
  foil_id: true,
  foil_type: true,
  color_coverage: true,
  labels_per_sheet: true,
  die_cut_id: true,
  print_note: true,
  has_print_sample: true,
  has_print_proof: true,
  ean_code: true,
  production_notes: true,
  approval_status: true,
  approval_date: true,
  color_count: true,
  print_colors_text: true,
  label_type: true,
  product_kind: true,
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
  const status = searchParams.get("item_status") ?? searchParams.get("status");
  const productKind = searchParams.get("product_kind")?.trim() ?? "";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { ig_code: { contains: search } },
      { ig_short_name: { contains: search } },
      { client_code: { contains: search } },
      { client_name: { contains: search } },
      { sku: { contains: search } },
      { product_format: { contains: search } },
      { label_shape_code: { contains: search } },
      { die_cut_tool_code: { contains: search } },
      { assembly_code: { contains: search } },
      { color_coverage: { contains: search } },
      { print_colors_text: { contains: search } },
      { foil_type: { contains: search } },
      { ean_code: { contains: search } },
      { requester: { contains: search } },
    ];
  }
  if (customerId) {
    const unitId = parseInt(customerId, 10);
    if (!Number.isNaN(unitId)) {
      where.customer_id = await resolveCatalogCustomerId(unitId);
    }
  }
  if (status) {
    where.item_status = status;
  }
  if (productKind === "iml" || productKind === "etikety") {
    where.product_kind = productKind;
  }

  const pageParam = searchParams.get("page");
  const perPageParam = searchParams.get("per_page");
  const paginated = pageParam !== null || perPageParam !== null;

  const listSelect = {
    ...productListSelect,
    iml_customers: { select: { id: true, name: true } },
  } as const;

  type ProductListRow = Prisma.iml_productsGetPayload<{ select: typeof listSelect }>;

  let products: ProductListRow[];
  let total: number | undefined;
  let page: number | undefined;
  let perPage: number | null | undefined;
  let totalPages: number | undefined;

  if (!paginated) {
    products = await prisma.iml_products.findMany({
      where,
      orderBy: { id: "desc" },
      take: 200,
      select: listSelect,
    });
  } else {
    page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
    const perPageRaw = perPageParam ?? "25";
    if (perPageRaw === "all") {
      perPage = null;
    } else {
      const parsed = parseInt(perPageRaw, 10);
      perPage = parsed === 50 || parsed === 100 ? parsed : 25;
    }
    const skip = perPage ? (page - 1) * perPage : 0;

    const [rows, count] = await Promise.all([
      prisma.iml_products.findMany({
        where,
        orderBy: { id: "desc" },
        skip: perPage ? skip : 0,
        take: perPage ?? undefined,
        select: listSelect,
      }),
      prisma.iml_products.count({ where }),
    ]);
    products = rows;
    total = count;
    totalPages = perPage ? Math.max(1, Math.ceil(count / perPage)) : 1;
  }

  // Efektivní flagy bez stahování blobů: jen OCTET_LENGTH > 0.
  let flagsById = new Map<number, { has_image: boolean; has_pdf: boolean }>();
  if (products.length > 0) {
    const ids = products.map((p) => p.id);
    const rows = await prisma.$queryRaw<
      Array<{ id: number; has_image: number; has_pdf: number }>
    >`
      SELECT p.id,
             CASE WHEN p.image_data IS NOT NULL AND OCTET_LENGTH(p.image_data) > 0 THEN 1 ELSE 0 END AS has_image,
             CASE
               WHEN (p.pdf_data IS NOT NULL AND OCTET_LENGTH(p.pdf_data) > 0) THEN 1
               WHEN EXISTS (
                 SELECT 1 FROM iml_product_files f
                 WHERE f.product_id = p.id
                   AND f.pdf_data IS NOT NULL
                   AND OCTET_LENGTH(f.pdf_data) > 0
               ) THEN 1
               ELSE 0
             END AS has_pdf
      FROM iml_products p
      WHERE p.id IN (${Prisma.join(ids)})
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

  if (!paginated) {
    return NextResponse.json({ products: productsWithFlags });
  }

  return NextResponse.json({
    products: productsWithFlags,
    total: total ?? productsWithFlags.length,
    page: page ?? 1,
    perPage: perPage ?? total ?? productsWithFlags.length,
    totalPages: totalPages ?? 1,
  });
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
    let data: Awaited<ReturnType<typeof parseImlProductBodyForSave>>;
    try {
      data = await parseImlProductBodyForSave(body);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Neplatná data produktu";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (data.sku) {
      const existing = await prisma.iml_products.findFirst({ where: { sku: data.sku } });
      if (existing) {
        return NextResponse.json({ error: "Produkt s tímto SKU již existuje" }, { status: 400 });
      }
    }

    const customDataForPrisma = data.custom_data;

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

    applyPrintColorsSummaryOnSave(
      data,
      body as Record<string, unknown>,
      colorsValidation?.ok ? colorsValidation.prepared : null
    );

    const createPayload = toImlProductCreateData({
      ...data,
      custom_data: customDataForPrisma,
      last_edited_by: editorName,
    });

    const txResult = await prisma.$transaction(async (tx) => {
      const created = await tx.iml_products.create({
        data: createPayload,
      });
      if (colorsValidation && colorsValidation.ok) {
        const res = await replaceProductColorsInTx(tx, created.id, colorsValidation.prepared, true);
        if (!res.ok) return { colorsReplaceFailed: res } as const;
      }
      return { productId: created.id } as const;
    });

    if ("colorsReplaceFailed" in txResult && txResult.colorsReplaceFailed) {
      const { status, body } = imlProductColorsReplaceErrorResponse(txResult.colorsReplaceFailed);
      return NextResponse.json(body, { status });
    }

    const productId = txResult.productId;

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
    const { status, error } = imlProductSaveErrorResponse(e, "Chyba při vytváření produktu");
    return NextResponse.json({ error }, { status });
  }
}

