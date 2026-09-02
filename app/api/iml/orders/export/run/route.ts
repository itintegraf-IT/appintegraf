import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { IML_ORDER_STATUS_EXPORTED } from "@/lib/iml-constants";
import {
  hasProductExportAssets,
  parseProductExportAssetOptions,
} from "@/lib/iml-export-products-assets";
import {
  loadOrderLinesForExport,
  renderOrderExportWithOptionalZip,
} from "@/lib/iml-export-orders-run";

/**
 * Spustí line-level export objednávek podle šablony nebo ad-hoc sloupců/filtrů.
 * Body: { templateId } | { format, columns, filters, include_print?, include_softproof? }
 * filters.order_ids — export konkrétních objednávek
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
      where: { id: templateId, user_id: userId, entity: "orders" },
    });
    if (!template) {
      return NextResponse.json({ error: "Šablona nenalezena" }, { status: 404 });
    }
    format = template.format === "xml" ? "xml" : "csv";
    columnsInput = template.columns;
    const templateFilters =
      template.filters && typeof template.filters === "object" ? template.filters : {};
    const override =
      body.filters && typeof body.filters === "object"
        ? (body.filters as Record<string, unknown>)
        : {};
    filtersInput = {
      ...(templateFilters as object),
      ...(override.order_ids != null ? { order_ids: override.order_ids } : {}),
    };
  }

  const filtersObj =
    filtersInput && typeof filtersInput === "object"
      ? (filtersInput as Record<string, unknown>)
      : {};
  const assetOpts = parseProductExportAssetOptions({ ...filtersObj, ...body });
  const withAssets = hasProductExportAssets(assetOpts);

  const { rows, columns } = await loadOrderLinesForExport(filtersInput, columnsInput, {
    withAssets,
  });

  try {
    const result = await renderOrderExportWithOptionalZip(format, rows, columns, assetOpts);

    if (
      result.exportedOrderIds.length > 0 &&
      (await hasModuleAccess(userId, "iml", "write"))
    ) {
      await prisma.iml_orders.updateMany({
        where: { id: { in: result.exportedOrderIds } },
        data: { status: IML_ORDER_STATUS_EXPORTED },
      });
    }

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
