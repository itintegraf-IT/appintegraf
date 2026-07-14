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
import { productMaterialIncludes } from "@/lib/iml/product-materials";
import { parseImlProductBodyForSave } from "@/lib/iml/parse-product-body";
import { applyPrintColorsSummaryOnSave } from "@/lib/iml-product-save-colors";
import {
  imlProductColorsReplaceErrorResponse,
  imlProductSaveErrorResponse,
} from "@/lib/iml-product-save-errors";
import { toImlProductUpdateData } from "@/lib/iml/product-prisma-payload";

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
        ...productMaterialIncludes,
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
    let data: Awaited<ReturnType<typeof parseImlProductBodyForSave>>;
    try {
      data = await parseImlProductBodyForSave(body);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Neplatná data produktu";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (data.sku) {
      const dup = await prisma.iml_products.findFirst({
        where: { sku: data.sku, NOT: { id } },
      });
      if (dup) {
        return NextResponse.json({ error: "Produkt s tímto SKU již existuje" }, { status: 400 });
      }
    }

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

    const customDataForPrisma = data.custom_data;
    const updatePayload = toImlProductUpdateData(
      {
        ...data,
        custom_data: customDataForPrisma,
        last_edited_by: editorName,
      },
      {
        customer_id: existing.customer_id,
        foil_id: existing.foil_id,
        foil_material_id: existing.foil_material_id,
        color_material_id: existing.color_material_id,
        paper_material_id: existing.paper_material_id,
        lacquer_material_id: existing.lacquer_material_id,
      }
    );

    const colorsReplaceFailed = await prisma.$transaction(async (tx) => {
      await tx.iml_products.update({
        where: { id },
        data: updatePayload,
      });
      if (colorsValidation && colorsValidation.ok) {
        const res = await replaceProductColorsInTx(tx, id, colorsValidation.prepared, true);
        if (!res.ok) return res;
      }
      return null;
    });

    if (colorsReplaceFailed) {
      const { status, body } = imlProductColorsReplaceErrorResponse(colorsReplaceFailed);
      return NextResponse.json(body, { status });
    }

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
    const { status, error } = imlProductSaveErrorResponse(e);
    return NextResponse.json({ error }, { status });
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

