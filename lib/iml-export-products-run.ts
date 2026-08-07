import { prisma } from "@/lib/db";
import {
  buildProductExportCsv,
  buildProductExportXml,
  sanitizeProductExportColumns,
  sanitizeProductExportFilters,
  type ProductExportColumnKey,
  type ProductExportFilters,
  type ProductExportSourceRow,
} from "@/lib/iml-export-product-columns";
import { resolveCatalogCustomerId } from "@/lib/iml-customer-catalog";

export async function loadProductsForExport(
  filtersInput: unknown,
  columnsInput: unknown
): Promise<{
  rows: ProductExportSourceRow[];
  columns: Array<{ key: ProductExportColumnKey; header?: string }>;
  filters: ProductExportFilters;
}> {
  const columns = sanitizeProductExportColumns(columnsInput);
  const filters = sanitizeProductExportFilters(filtersInput);

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

  const needPantone = columns.some((c) => c.key === "pantone_codes");

  const products = await prisma.iml_products.findMany({
    where,
    orderBy: { id: "desc" },
    take: 5000,
    include: {
      iml_customers: { select: { name: true } },
      ...(needPantone
        ? {
            iml_product_colors: {
              include: { iml_pantone_colors: { select: { code: true } } },
              orderBy: [{ sort_order: "asc" as const }, { id: "asc" as const }],
            },
          }
        : {}),
    },
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
  columns: Array<{ key: ProductExportColumnKey; header?: string }>
): { body: string; contentType: string; filename: string } {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "xml") {
    return {
      body: buildProductExportXml(rows, columns),
      contentType: "application/xml; charset=utf-8",
      filename: `iml-produkty-${stamp}.xml`,
    };
  }
  return {
    body: buildProductExportCsv(rows, columns),
    contentType: "text/csv; charset=utf-8",
    filename: `iml-produkty-${stamp}.csv`,
  };
}
