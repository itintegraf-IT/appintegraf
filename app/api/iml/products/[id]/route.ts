import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import {
  replaceProductColorsInTx,
  validateProductColorsInput,
  type IncomingProductColor,
} from "@/lib/iml-product-colors";
import { imlProductHasPdfInFilesTable } from "@/lib/iml-product-pdf-flag";

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

  const [product, hasFileTablePdf] = await Promise.all([
    prisma.iml_products.findUnique({
      where: { id },
      include: {
        iml_customers: { select: { id: true, name: true } },
        iml_foils: { select: { id: true, code: true, name: true } },
        iml_product_colors: {
          include: {
            iml_pantone_colors: {
              select: { id: true, code: true, name: true, hex: true, is_active: true },
            },
          },
          orderBy: [{ sort_order: "asc" }, { id: "asc" }],
        },
      },
    }),
    imlProductHasPdfInFilesTable(id),
  ]);

  if (!product) {
    return NextResponse.json({ error: "Produkt nenalezen" }, { status: 404 });
  }

  const { image_data, pdf_data, ...rest } = product;
  const hasPdf = (!!pdf_data && pdf_data.length > 0) || hasFileTablePdf;
  return NextResponse.json({
    ...rest,
    has_image: !!image_data && image_data.length > 0,
    has_pdf: hasPdf,
  });
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

  const existing = await prisma.iml_products.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Produkt nenalezen" }, { status: 404 });
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
      const dup = await prisma.iml_products.findFirst({
        where: { sku: data.sku, NOT: { id } },
      });
      if (dup) {
        return NextResponse.json({ error: "Produkt s tímto SKU již existuje" }, { status: 400 });
      }
    }

    const customDataForPrisma = data.custom_data;
    const updatePayload = { ...data, custom_data: customDataForPrisma, last_edited_by: editorName };

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

    await prisma.$transaction(async (tx) => {
      await tx.iml_products.update({
        where: { id },
        data: updatePayload as Parameters<typeof tx.iml_products.update>[0]["data"],
      });
      if (colorsValidation && colorsValidation.ok) {
        const res = await replaceProductColorsInTx(tx, id, colorsValidation.prepared, true);
        if (!res.ok) throw new Error(res.error);
      }
    });

    await logImlAudit({
      userId,
      action: "update",
      tableName: "iml_products",
      recordId: id,
      oldValues: { ig_code: existing.ig_code, client_name: existing.client_name },
      newValues: { ig_code: data.ig_code, client_name: data.client_name },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("IML products PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání produktu" }, { status: 500 });
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

  const existing = await prisma.iml_products.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Produkt nenalezen" }, { status: 404 });
  }

  await prisma.iml_products.delete({ where: { id } });

  await logImlAudit({
    userId,
    action: "delete",
    tableName: "iml_products",
    recordId: id,
    oldValues: { ig_code: existing.ig_code, client_name: existing.client_name },
  });

  return NextResponse.json({ success: true });
}

function parseProductBody(body: Record<string, unknown>) {
  const str = (v: unknown) => (v != null && v !== "" ? String(v).trim() : null);
  const int = (v: unknown) => (v != null && v !== "" ? parseInt(String(v), 10) : null);

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

/** labels_per_sheet > 0 nebo NULL. */
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
