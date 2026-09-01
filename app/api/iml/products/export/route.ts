import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { escapeCsv } from "@/lib/iml-export";
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

function mapProductToQuickRow(p: {
  id: number;
  ig_code: string | null;
  ig_short_name: string | null;
  client_code: string | null;
  client_name: string | null;
  sku: string | null;
  product_kind: string | null;
  requester: string | null;
  label_shape_code: string | null;
  product_format: string | null;
  format_width_mm: unknown;
  format_height_mm: unknown;
  die_cut_tool_code: string | null;
  assembly_code: string | null;
  positions_on_sheet: number | null;
  pieces_per_box: number | null;
  pieces_per_pallet: number | null;
  foil_type: string | null;
  foil_material_id: number | null;
  color_coverage: string | null;
  color_material_id: number | null;
  paper_material_id: number | null;
  lacquer_material_id: number | null;
  ean_code: string | null;
  item_status: string | null;
  approval_status: string | null;
  approval_date: Date | null;
  color_count: number | null;
  print_colors_text: string | null;
  label_type: string | null;
  has_print_sample: boolean | null;
  has_print_proof: boolean | null;
  is_active: boolean | null;
  created_at: Date | null;
  updated_at: Date | null;
  iml_customers?: { name: string } | null;
}): QuickExportRow {
  return {
    id: p.id,
    ig_code: p.ig_code ?? "",
    ig_short_name: p.ig_short_name ?? "",
    client_code: p.client_code ?? "",
    client_name: p.client_name ?? "",
    sku: p.sku ?? "",
    product_kind: p.product_kind ?? "iml",
    customer_name: p.iml_customers?.name ?? "",
    requester: p.requester ?? "",
    label_shape_code: p.label_shape_code ?? "",
    product_format: p.product_format ?? "",
    format_width_mm: p.format_width_mm != null ? String(p.format_width_mm) : "",
    format_height_mm: p.format_height_mm != null ? String(p.format_height_mm) : "",
    die_cut_tool_code: p.die_cut_tool_code ?? "",
    assembly_code: p.assembly_code ?? "",
    positions_on_sheet: p.positions_on_sheet ?? "",
    pieces_per_box: p.pieces_per_box ?? "",
    pieces_per_pallet: p.pieces_per_pallet ?? "",
    foil_type: p.foil_type ?? "",
    foil_material_id: p.foil_material_id ?? "",
    color_coverage: p.color_coverage ?? "",
    color_material_id: p.color_material_id ?? "",
    paper_material_id: p.paper_material_id ?? "",
    lacquer_material_id: p.lacquer_material_id ?? "",
    ean_code: p.ean_code ?? "",
    item_status: p.item_status ?? "",
    approval_status: p.approval_status ?? "",
    approval_date: p.approval_date
      ? new Date(p.approval_date).toISOString().slice(0, 10)
      : "",
    color_count: p.color_count ?? "",
    print_colors_text: p.print_colors_text ?? "",
    label_type: p.label_type ?? "",
    has_print_sample: p.has_print_sample ? "ano" : "ne",
    has_print_proof: p.has_print_proof ? "ano" : "ne",
    is_active: p.is_active ? "ano" : "ne",
    created_at: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "",
    updated_at: p.updated_at ? new Date(p.updated_at).toISOString().slice(0, 10) : "",
  };
}

const QUICK_CSV_HEADER =
  "id;ig_code;ig_short_name;client_code;client_name;sku;product_kind;customer_name;requester;label_shape_code;product_format;format_width_mm;format_height_mm;die_cut_tool_code;assembly_code;positions_on_sheet;pieces_per_box;pieces_per_pallet;foil_type;foil_material_id;color_coverage;color_material_id;paper_material_id;lacquer_material_id;ean_code;item_status;approval_status;approval_date;color_count;print_colors_text;label_type;has_print_sample;has_print_proof;is_active;created_at;updated_at";

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
    const base = [
      r.id,
      escapeCsv(String(r.ig_code)),
      escapeCsv(String(r.ig_short_name)),
      escapeCsv(String(r.client_code)),
      escapeCsv(String(r.client_name)),
      escapeCsv(String(r.sku)),
      escapeCsv(String(r.product_kind)),
      escapeCsv(String(r.customer_name)),
      escapeCsv(String(r.requester)),
      escapeCsv(String(r.label_shape_code)),
      escapeCsv(String(r.product_format)),
      r.format_width_mm,
      r.format_height_mm,
      escapeCsv(String(r.die_cut_tool_code)),
      escapeCsv(String(r.assembly_code)),
      r.positions_on_sheet,
      r.pieces_per_box,
      r.pieces_per_pallet,
      escapeCsv(String(r.foil_type)),
      r.foil_material_id,
      escapeCsv(String(r.color_coverage)),
      r.color_material_id,
      r.paper_material_id,
      r.lacquer_material_id,
      escapeCsv(String(r.ean_code)),
      escapeCsv(String(r.item_status)),
      escapeCsv(String(r.approval_status)),
      escapeCsv(String(r.approval_date)),
      r.color_count,
      escapeCsv(String(r.print_colors_text)),
      escapeCsv(String(r.label_type)),
      escapeCsv(String(r.has_print_sample)),
      escapeCsv(String(r.has_print_proof)),
      escapeCsv(String(r.is_active)),
      escapeCsv(String(r.created_at)),
      escapeCsv(String(r.updated_at)),
    ];
    if (assetOpts.includePrint) base.push(escapeCsv(String(r.soubor_tisk ?? "")));
    if (assetOpts.includeSoftproof) base.push(escapeCsv(String(r.soubor_softproof ?? "")));
    return base.join(";");
  });

  return [header, ...csvRows].join("\n");
}

function buildQuickXlsxBuffer(rows: QuickExportRow[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
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

  const productQuery = {
    where,
    orderBy: { id: "desc" as const },
  };

  const products = withAssets
    ? await prisma.iml_products.findMany({
        ...productQuery,
        take: PRODUCT_EXPORT_ASSETS_MAX_ROWS + 1,
        select: {
          id: true,
          ig_code: true,
          ig_short_name: true,
          client_code: true,
          client_name: true,
          sku: true,
          product_kind: true,
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
          foil_type: true,
          foil_material_id: true,
          color_coverage: true,
          color_material_id: true,
          paper_material_id: true,
          lacquer_material_id: true,
          ean_code: true,
          item_status: true,
          approval_status: true,
          approval_date: true,
          color_count: true,
          print_colors_text: true,
          label_type: true,
          has_print_sample: true,
          has_print_proof: true,
          is_active: true,
          created_at: true,
          updated_at: true,
          image_data: true,
          iml_customers: { select: { name: true } },
        },
      })
    : await prisma.iml_products.findMany({
        ...productQuery,
        include: { iml_customers: { select: { name: true } } },
      });

  if (withAssets && products.length > PRODUCT_EXPORT_ASSETS_MAX_ROWS) {
    return NextResponse.json(
      {
        error: `Export s tiskovými daty / softproofem je omezen na ${PRODUCT_EXPORT_ASSETS_MAX_ROWS} produktů. Zúžte filtr.`,
      },
      { status: 400 }
    );
  }

  let rows = products.map((p) => mapProductToQuickRow(p));

  const stamp = new Date().toISOString().slice(0, 10);

  if (withAssets) {
    const { files, paths } = await collectProductExportAssets(
      products.map((p) => ({
        id: p.id,
        ig_code: p.ig_code,
        image_data: (p as { image_data?: Buffer | null }).image_data,
      })),
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
