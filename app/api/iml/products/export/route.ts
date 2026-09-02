import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { escapeCsv } from "@/lib/iml-export";
import {
  PRODUCT_EXPORT_FIELD_DEFS,
  PRODUCT_EXPORT_FIELD_KEYS,
  buildProductExportPrismaInclude,
  buildProductExportPrismaSelect,
  mapDbProductToExportRow,
  serializeProductFieldValue,
  type ProductExportFieldKey,
  type ProductExportSourceRow,
} from "@/lib/iml-export-product-field-catalog";
import {
  collectProductExportAssets,
  hasProductExportAssets,
  parseProductExportAssetOptions,
  PRODUCT_EXPORT_ASSETS_MAX_ROWS,
  type ProductAssetPathMap,
  type ProductExportAssetOptions,
} from "@/lib/iml-export-products-assets";
import { buildProductExportZip } from "@/lib/iml-export-products-zip";

type QuickExportRow = Record<string, string | number>;

function buildQuickExportWhere(searchParams: URLSearchParams): Record<string, unknown> {
  const search = searchParams.get("search")?.trim() ?? "";
  const customerId = searchParams.get("customer_id");
  const status = searchParams.get("status");
  const productKind = searchParams.get("product_kind")?.trim() ?? "";
  const archiveFilter = (searchParams.get("archive") ?? "active").trim().toLowerCase();

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
  if (customerId) where.customer_id = parseInt(customerId, 10);
  if (status) where.item_status = status;
  if (productKind === "iml" || productKind === "etikety") where.product_kind = productKind;
  if (archiveFilter === "archived") where.archived_at = { not: null };
  else if (archiveFilter !== "all") where.archived_at = null;
  return where;
}

function mapProductToQuickRow(p: ProductExportSourceRow): QuickExportRow {
  const row: QuickExportRow = { id: p.id };
  for (const key of PRODUCT_EXPORT_FIELD_KEYS) {
    if (key === "id") continue;
    row[key] = serializeProductFieldValue(p, key);
  }
  return row;
}

const QUICK_CSV_HEADER = PRODUCT_EXPORT_FIELD_KEYS.join(";");

function appendAssetPathsToRows(
  rows: QuickExportRow[],
  paths: ProductAssetPathMap,
  assetOpts: ProductExportAssetOptions
): QuickExportRow[] {
  return rows.map((row) => ({
    ...row,
    ...(assetOpts.includePrint
      ? { soubor_tisk: paths.get(Number(row.id))?.soubor_tisk ?? "" }
      : {}),
    ...(assetOpts.includeSoftproof
      ? { soubor_softproof: paths.get(Number(row.id))?.soubor_softproof ?? "" }
      : {}),
  }));
}

function buildQuickCsv(rows: QuickExportRow[], assetOpts: ProductExportAssetOptions): string {
  let header = QUICK_CSV_HEADER;
  if (assetOpts.includePrint) header += ";soubor_tisk";
  if (assetOpts.includeSoftproof) header += ";soubor_softproof";

  const csvRows = rows.map((r) => {
    const base = PRODUCT_EXPORT_FIELD_KEYS.map((key) => {
      const val = r[key as ProductExportFieldKey];
      return key === "id" ? String(val ?? "") : escapeCsv(String(val ?? ""));
    });
    if (assetOpts.includePrint) base.push(escapeCsv(String(r.soubor_tisk ?? "")));
    if (assetOpts.includeSoftproof) base.push(escapeCsv(String(r.soubor_softproof ?? "")));
    return base.join(";");
  });

  return [header, ...csvRows].join("\n");
}

function buildQuickXlsxBuffer(rows: QuickExportRow[]): Buffer {
  const labeled = rows.map((row) => {
    const out: Record<string, string | number> = {};
    for (const def of PRODUCT_EXPORT_FIELD_DEFS) {
      out[def.label] = row[def.key] ?? "";
    }
    return out;
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(labeled);
  XLSX.utils.book_append_sheet(wb, ws, "Produkty");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
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
  const format = searchParams.get("format") || "csv";
  const assetOpts = parseProductExportAssetOptions({
    include_print: searchParams.get("include_print"),
    include_softproof: searchParams.get("include_softproof"),
  });
  const withAssets = hasProductExportAssets(assetOpts);
  const where = buildQuickExportWhere(searchParams);
  const allColumns = PRODUCT_EXPORT_FIELD_DEFS.map((d) => ({ key: d.key }));

  const productQuery = {
    where,
    orderBy: { id: "desc" as const },
  };

  const products = withAssets
    ? await prisma.iml_products.findMany({
        ...productQuery,
        take: PRODUCT_EXPORT_ASSETS_MAX_ROWS + 1,
        select: buildProductExportPrismaSelect(allColumns, {
          withAssets: true,
        }) as never,
      })
    : await prisma.iml_products.findMany({
        ...productQuery,
        include: buildProductExportPrismaInclude(allColumns, {
          needPantone: true,
          needMaterials: true,
        }) as never,
      });

  if (withAssets && products.length > PRODUCT_EXPORT_ASSETS_MAX_ROWS) {
    return NextResponse.json(
      {
        error: `Export s tiskovými daty / softproofem je omezen na ${PRODUCT_EXPORT_ASSETS_MAX_ROWS} produktů. Zúžte filtr.`,
      },
      { status: 400 }
    );
  }

  let rows = (products as Record<string, unknown>[]).map((p) =>
    mapProductToQuickRow(mapDbProductToExportRow(p)!)
  );

  const stamp = new Date().toISOString().slice(0, 10);

  if (withAssets) {
    const { files, paths } = await collectProductExportAssets(
      products.map((p) => {
        const row = mapDbProductToExportRow(p as Record<string, unknown>);
        return {
          id: row!.id,
          ig_code: row!.ig_code,
          image_data: row!.image_data,
        };
      }),
      assetOpts
    );
    rows = appendAssetPathsToRows(rows, paths, assetOpts);

    let tableBuffer: Buffer;
    let tableFilename: string;
    if (format === "xlsx") {
      tableBuffer = buildQuickXlsxBuffer(rows);
      tableFilename = `iml-produkty-${stamp}.xlsx`;
    } else {
      tableBuffer = Buffer.from("\uFEFF" + buildQuickCsv(rows, assetOpts), "utf-8");
      tableFilename = `iml-produkty-${stamp}.csv`;
    }

    const zip = await buildProductExportZip({
      tableBuffer,
      tableFilename,
      assets: files,
      manifest: {
        exportedAt: new Date().toISOString(),
        rowCount: rows.length,
        assetCount: files.length,
        includePrint: assetOpts.includePrint,
        includeSoftproof: assetOpts.includeSoftproof,
      },
    });

    return new NextResponse(new Uint8Array(zip.buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zip.filename}"`,
      },
    });
  }

  if (format === "xlsx") {
    const buf = buildQuickXlsxBuffer(rows);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="iml-produkty.xlsx"',
      },
    });
  }

  const csv = buildQuickCsv(rows, assetOpts);
  return new NextResponse("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="iml-produkty.csv"',
    },
  });
}
