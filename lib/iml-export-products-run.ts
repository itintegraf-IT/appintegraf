import { prisma } from "@/lib/db";
import {
  buildProductExportPrismaInclude,
  buildProductExportPrismaSelect,
  productExportNeedsMaterials,
  productExportNeedsPantone,
  type ProductExportSourceRow,
} from "@/lib/iml-export-product-field-catalog";
import {
  buildProductExportCsv,
  buildProductExportCsvWithAssetPaths,
  buildProductExportXml,
  buildProductExportXmlWithAssetPaths,
  sanitizeProductExportColumns,
  sanitizeProductExportFilters,
  type ProductExportColumnKey,
  type ProductExportFilters,
} from "@/lib/iml-export-product-columns";
import { resolveCatalogCustomerId } from "@/lib/iml-customer-catalog";
import {
  collectProductExportAssets,
  hasProductExportAssets,
  PRODUCT_EXPORT_ASSETS_MAX_ROWS,
  type ProductExportAssetOptions,
  type ProductAssetPathMap,
} from "@/lib/iml-export-products-assets";
import { buildProductExportZip } from "@/lib/iml-export-products-zip";

export type LoadProductsForExportOptions = {
  withAssets?: boolean;
  maxRows?: number;
};

export async function loadProductsForExport(
  filtersInput: unknown,
  columnsInput: unknown,
  loadOpts?: LoadProductsForExportOptions
): Promise<{
  rows: ProductExportSourceRow[];
  columns: Array<{ key: ProductExportColumnKey; header?: string }>;
  filters: ProductExportFilters;
}> {
  const columns = sanitizeProductExportColumns(columnsInput);
  const filters = sanitizeProductExportFilters(filtersInput);
  const withAssets = loadOpts?.withAssets === true;
  const assetMax = PRODUCT_EXPORT_ASSETS_MAX_ROWS;
  const maxRows = withAssets
    ? Math.min(loadOpts?.maxRows ?? assetMax, assetMax) + 1
    : loadOpts?.maxRows ?? 5000;

  const where: Record<string, unknown> = {};
  if (filters.search) {
    where.OR = [
      { ig_code: { contains: filters.search } },
      { ig_short_name: { contains: filters.search } },
      { client_code: { contains: filters.search } },
      { client_name: { contains: filters.search } },
      { sku: { contains: filters.search } },
    ];
  }
  if (filters.customer_id != null) {
    where.customer_id = await resolveCatalogCustomerId(filters.customer_id);
  }
  if (filters.item_status) where.item_status = filters.item_status;
  if (filters.product_kind) where.product_kind = filters.product_kind;

  const archive = filters.archive ?? "active";
  if (archive === "archived") where.archived_at = { not: null };
  else if (archive !== "all") where.archived_at = null;

  const needPantone = productExportNeedsPantone(columns);
  const needMaterials = productExportNeedsMaterials(columns);

  const products = withAssets
    ? await prisma.iml_products.findMany({
        where,
        orderBy: { id: "desc" },
        take: maxRows,
        select: buildProductExportPrismaSelect(columns, {
          withAssets: true,
        }) as never,
      })
    : await prisma.iml_products.findMany({
        where,
        orderBy: { id: "desc" },
        take: maxRows,
        include: buildProductExportPrismaInclude(columns, {
          needPantone,
          needMaterials,
        }) as never,
      });

  return {
    rows: products as unknown as ProductExportSourceRow[],
    columns,
    filters,
  };
}

export function renderProductExport(
  format: "csv" | "xml",
  rows: ProductExportSourceRow[],
  columns: Array<{ key: ProductExportColumnKey; header?: string }>,
  assetOpts?: ProductExportAssetOptions,
  assetPaths?: ProductAssetPathMap
): { body: string; contentType: string; filename: string } {
  const stamp = new Date().toISOString().slice(0, 10);
  const useAssets =
    assetOpts &&
    assetPaths &&
    hasProductExportAssets(assetOpts);

  if (format === "xml") {
    return {
      body: useAssets
        ? buildProductExportXmlWithAssetPaths(rows, columns, assetPaths, assetOpts)
        : buildProductExportXml(rows, columns),
      contentType: "application/xml; charset=utf-8",
      filename: `iml-produkty-${stamp}.xml`,
    };
  }
  return {
    body: useAssets
      ? buildProductExportCsvWithAssetPaths(rows, columns, assetPaths, assetOpts)
      : buildProductExportCsv(rows, columns),
    contentType: "text/csv; charset=utf-8",
    filename: `iml-produkty-${stamp}.csv`,
  };
}

export async function renderProductExportWithOptionalZip(
  format: "csv" | "xml",
  rows: ProductExportSourceRow[],
  columns: Array<{ key: ProductExportColumnKey; header?: string }>,
  assetOpts: ProductExportAssetOptions
): Promise<
  | { kind: "file"; body: string; contentType: string; filename: string }
  | { kind: "zip"; buffer: Buffer; filename: string }
> {
  if (!hasProductExportAssets(assetOpts)) {
    const rendered = renderProductExport(format, rows, columns);
    return { kind: "file", ...rendered };
  }

  if (rows.length > PRODUCT_EXPORT_ASSETS_MAX_ROWS) {
    throw new Error(
      `Export s tiskovými daty / softproofem je omezen na ${PRODUCT_EXPORT_ASSETS_MAX_ROWS} produktů (nalezeno ${rows.length}). Zúžte filtr.`
    );
  }

  const { files, paths } = await collectProductExportAssets(
    rows.map((r) => ({
      id: r.id,
      ig_code: r.ig_code,
      image_data: r.image_data,
    })),
    assetOpts
  );

  const rendered = renderProductExport(format, rows, columns, assetOpts, paths);
  const tableBuffer = Buffer.from(
    format === "csv" ? "\uFEFF" + rendered.body : rendered.body,
    "utf-8"
  );

  const zip = await buildProductExportZip({
    tableBuffer,
    tableFilename: rendered.filename,
    assets: files,
    manifest: {
      exportedAt: new Date().toISOString(),
      rowCount: rows.length,
      assetCount: files.length,
      includePrint: assetOpts.includePrint,
      includeSoftproof: assetOpts.includeSoftproof,
    },
  });

  return { kind: "zip", buffer: zip.buffer, filename: zip.filename };
}
