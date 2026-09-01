import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import {
  hasProductExportAssets,
  parseProductExportAssetOptions,
  PRODUCT_EXPORT_ASSETS_MAX_ROWS,
} from "@/lib/iml-export-products-assets";
import {
  loadProductsForExport,
  renderProductExportWithOptionalZip,
} from "@/lib/iml-export-products-run";

/**
 * Spustí export produktů podle šablony nebo ad-hoc sloupců/filtrů.
 * Body: { templateId } | { format, columns, filters, include_print?, include_softproof? }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Neplatné tělo" }, { status: 400 });
  }

  let format: "csv" | "xml" = body.format === "xml" ? "xml" : "csv";
  let columnsInput: unknown = body.columns;
  let filtersInput: unknown = body.filters;

  if (body.templateId != null) {
    const templateId = parseInt(String(body.templateId), 10);
    if (Number.isNaN(templateId)) {
      return NextResponse.json({ error: "Neplatné ID šablony" }, { status: 400 });
    }
    const template = await prisma.iml_export_templates.findFirst({
      where: { id: templateId, user_id: userId, entity: "products" },
    });
    if (!template) {
      return NextResponse.json({ error: "Šablona nenalezena" }, { status: 404 });
    }
    format = template.format === "xml" ? "xml" : "csv";
    columnsInput = template.columns;
    filtersInput = template.filters;
  }

  const filtersObj =
    filtersInput && typeof filtersInput === "object"
      ? (filtersInput as Record<string, unknown>)
      : {};
  const assetOpts = parseProductExportAssetOptions({ ...filtersObj, ...body });
  const withAssets = hasProductExportAssets(assetOpts);

  const { rows: loadedRows, columns } = await loadProductsForExport(
    filtersInput,
    columnsInput,
    { withAssets }
  );

  if (withAssets && loadedRows.length > PRODUCT_EXPORT_ASSETS_MAX_ROWS) {
    return NextResponse.json(
      {
        error: `Export s tiskovými daty / softproofem je omezen na ${PRODUCT_EXPORT_ASSETS_MAX_ROWS} produktů. Zúžte filtr.`,
      },
      { status: 400 }
    );
  }

  const rows = withAssets
    ? loadedRows.slice(0, PRODUCT_EXPORT_ASSETS_MAX_ROWS)
    : loadedRows;

  try {
    const result = await renderProductExportWithOptionalZip(format, rows, columns, assetOpts);

    if (result.kind === "zip") {
      return new NextResponse(new Uint8Array(result.buffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${result.filename}"`,
          "X-Export-Row-Count": String(rows.length),
        },
      });
    }

    const bom = format === "csv" ? "\uFEFF" : "";
    return new NextResponse(bom + result.body, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "X-Export-Row-Count": String(rows.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export selhal";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
