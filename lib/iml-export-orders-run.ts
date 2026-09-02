import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  buildOrderLineExportCsv,
  buildOrderLineExportCsvWithAssetPaths,
  buildOrderLineExportXml,
  buildOrderLineExportXmlWithAssetPaths,
  sanitizeOrderExportColumns,
  sanitizeOrderExportFilters,
  type OrderExportFilters,
  type OrderLineExportColumnKey,
  type OrderLineExportSourceRow,
} from "@/lib/iml-export-order-columns";
import {
  collectProductExportAssets,
  hasProductExportAssets,
  PRODUCT_EXPORT_ASSETS_MAX_ROWS,
  type ProductExportAssetOptions,
  type ProductAssetPathMap,
} from "@/lib/iml-export-products-assets";
import { buildProductExportZip } from "@/lib/iml-export-products-zip";

const MAX_ORDERS = 2000;

export type LoadOrderLinesForExportOptions = {
  withAssets?: boolean;
};

type ProductWithImage = {
  id: number;
  ig_code: string | null;
  image_data?: Buffer | null;
};

export async function loadOrderLinesForExport(
  filtersInput: unknown,
  columnsInput: unknown,
  loadOpts?: LoadOrderLinesForExportOptions
): Promise<{
  rows: OrderLineExportSourceRow[];
  columns: Array<{ key: OrderLineExportColumnKey; header?: string }>;
  filters: OrderExportFilters;
}> {
  const columns = sanitizeOrderExportColumns(columnsInput);
  const filters = sanitizeOrderExportFilters(filtersInput);
  const withAssets = loadOpts?.withAssets === true;

  const where: Prisma.iml_ordersWhereInput = {};
  if (filters.order_ids?.length) {
    where.id = { in: filters.order_ids };
  }
  if (filters.customer_id != null) where.customer_id = filters.customer_id;
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { order_number: { contains: filters.search } },
      { job_number: { contains: filters.search } },
      { notes: { contains: filters.search } },
    ];
  }
  if (filters.date_from || filters.date_to) {
    where.order_date = {};
    if (filters.date_from) {
      where.order_date.gte = new Date(`${filters.date_from}T00:00:00`);
    }
    if (filters.date_to) {
      where.order_date.lte = new Date(`${filters.date_to}T23:59:59`);
    }
  }

  const needPantone = columns.some((c) => c.key === "pantone_codes");

  const productSelect = {
    id: true,
    ig_code: true,
    ig_short_name: true,
    client_code: true,
    client_name: true,
    sku: true,
    product_kind: true,
    label_shape_code: true,
    product_format: true,
    format_width_mm: true,
    format_height_mm: true,
    die_cut_tool_code: true,
    foil_type: true,
    ean_code: true,
    item_status: true,
    print_colors_text: true,
    color_count: true,
    ...(withAssets ? { image_data: true } : {}),
    ...(needPantone
      ? {
          iml_product_colors: {
            orderBy: [{ sort_order: "asc" as const }, { id: "asc" as const }],
            select: {
              iml_pantone_colors: { select: { code: true } },
            },
          },
        }
      : {}),
  };

  const orders = await prisma.iml_orders.findMany({
    where,
    orderBy: { order_date: "desc" },
    take: MAX_ORDERS,
    include: {
      iml_customers: { select: { name: true } },
      iml_order_items: {
        orderBy: { id: "asc" },
        include: {
          iml_products: {
            select: productSelect,
          },
        },
      },
    },
  });

  const rows: OrderLineExportSourceRow[] = [];
  for (const order of orders) {
    const items = order.iml_order_items;
    if (items.length === 0) {
      rows.push({
        order_id: order.id,
        order_number: order.order_number,
        job_number: order.job_number,
        customer_name: order.iml_customers?.name ?? "",
        order_date: order.order_date,
        expected_ship_date: order.expected_ship_date,
        status: order.status,
        total: order.total,
        notes: order.notes,
        shipping_snapshot_label: order.shipping_snapshot_label,
        shipping_snapshot_recipient: order.shipping_snapshot_recipient,
        shipping_snapshot_street: order.shipping_snapshot_street,
        shipping_snapshot_city: order.shipping_snapshot_city,
        shipping_snapshot_postal_code: order.shipping_snapshot_postal_code,
        shipping_snapshot_country: order.shipping_snapshot_country,
        order_created_at: order.created_at,
        line_id: 0,
        quantity: 0,
        unit_price: null,
        subtotal: null,
        product_id: null,
        ig_code: null,
        ig_short_name: null,
        client_code: null,
        client_name: null,
        sku: null,
        product_kind: null,
        label_shape_code: null,
        product_format: null,
        format_width_mm: null,
        format_height_mm: null,
        die_cut_tool_code: null,
        foil_type: null,
        ean_code: null,
        item_status: null,
        print_colors_text: null,
        color_count: null,
        pantone_codes: "",
      });
      continue;
    }

    for (const item of items) {
      const p = item.iml_products as ProductWithImage & Record<string, unknown> | null;
      const pantone =
        needPantone && p && "iml_product_colors" in p && Array.isArray(p.iml_product_colors)
          ? (p.iml_product_colors as Array<{ iml_pantone_colors?: { code: string | null } | null }>)
              .map((c) => c.iml_pantone_colors?.code)
              .filter(Boolean)
              .join(", ")
          : "";

      rows.push({
        order_id: order.id,
        order_number: order.order_number,
        job_number: order.job_number,
        customer_name: order.iml_customers?.name ?? "",
        order_date: order.order_date,
        expected_ship_date: order.expected_ship_date,
        status: order.status,
        total: order.total,
        notes: order.notes,
        shipping_snapshot_label: order.shipping_snapshot_label,
        shipping_snapshot_recipient: order.shipping_snapshot_recipient,
        shipping_snapshot_street: order.shipping_snapshot_street,
        shipping_snapshot_city: order.shipping_snapshot_city,
        shipping_snapshot_postal_code: order.shipping_snapshot_postal_code,
        shipping_snapshot_country: order.shipping_snapshot_country,
        order_created_at: order.created_at,
        line_id: item.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        product_id: p?.id ?? null,
        ig_code: (p?.ig_code as string | null) ?? null,
        ig_short_name: (p?.ig_short_name as string | null) ?? null,
        client_code: (p?.client_code as string | null) ?? null,
        client_name: (p?.client_name as string | null) ?? null,
        sku: (p?.sku as string | null) ?? null,
        product_kind: (p?.product_kind as string | null) ?? null,
        label_shape_code: (p?.label_shape_code as string | null) ?? null,
        product_format: (p?.product_format as string | null) ?? null,
        format_width_mm: p?.format_width_mm ?? null,
        format_height_mm: p?.format_height_mm ?? null,
        die_cut_tool_code: (p?.die_cut_tool_code as string | null) ?? null,
        foil_type: (p?.foil_type as string | null) ?? null,
        ean_code: (p?.ean_code as string | null) ?? null,
        item_status: (p?.item_status as string | null) ?? null,
        print_colors_text: (p?.print_colors_text as string | null) ?? null,
        color_count: (p?.color_count as number | null) ?? null,
        pantone_codes: pantone,
        ...(withAssets && p
          ? { image_data: p.image_data as Buffer | null | undefined }
          : {}),
      } as OrderLineExportSourceRow & { image_data?: Buffer | null });
    }
  }

  return { rows, columns, filters };
}

export function getExportedOrderIds(rows: OrderLineExportSourceRow[]): number[] {
  return [...new Set(rows.map((r) => r.order_id))];
}

function uniqueProductsFromOrderRows(
  rows: OrderLineExportSourceRow[]
): Array<{ id: number; ig_code: string | null; image_data?: Buffer | null }> {
  const byId = new Map<number, { id: number; ig_code: string | null; image_data?: Buffer | null }>();
  for (const row of rows) {
    if (row.product_id == null) continue;
    if (byId.has(row.product_id)) continue;
    const ext = row as OrderLineExportSourceRow & { image_data?: Buffer | null };
    byId.set(row.product_id, {
      id: row.product_id,
      ig_code: row.ig_code,
      image_data: ext.image_data,
    });
  }
  return [...byId.values()];
}

export function renderOrderLineExport(
  format: "csv" | "xml",
  rows: OrderLineExportSourceRow[],
  columns: Array<{ key: OrderLineExportColumnKey; header?: string }>,
  assetOpts?: ProductExportAssetOptions,
  assetPaths?: ProductAssetPathMap
): { body: string; contentType: string; filename: string } {
  const stamp = new Date().toISOString().slice(0, 10);
  const useAssets =
    assetOpts && assetPaths && hasProductExportAssets(assetOpts);

  if (format === "xml") {
    return {
      body: useAssets
        ? buildOrderLineExportXmlWithAssetPaths(rows, columns, assetPaths, assetOpts)
        : buildOrderLineExportXml(rows, columns),
      contentType: "application/xml; charset=utf-8",
      filename: `iml-objednavky-${stamp}.xml`,
    };
  }
  return {
    body: useAssets
      ? buildOrderLineExportCsvWithAssetPaths(rows, columns, assetPaths, assetOpts)
      : buildOrderLineExportCsv(rows, columns),
    contentType: "text/csv; charset=utf-8",
    filename: `iml-objednavky-${stamp}.csv`,
  };
}

export async function renderOrderExportWithOptionalZip(
  format: "csv" | "xml",
  rows: OrderLineExportSourceRow[],
  columns: Array<{ key: OrderLineExportColumnKey; header?: string }>,
  assetOpts: ProductExportAssetOptions
): Promise<
  | { kind: "file"; body: string; contentType: string; filename: string; exportedOrderIds: number[] }
  | { kind: "zip"; buffer: Buffer; filename: string; exportedOrderIds: number[] }
> {
  const exportedOrderIds = getExportedOrderIds(rows);

  if (!hasProductExportAssets(assetOpts)) {
    const rendered = renderOrderLineExport(format, rows, columns);
    return { kind: "file", ...rendered, exportedOrderIds };
  }

  const uniqueProducts = uniqueProductsFromOrderRows(rows);
  if (uniqueProducts.length > PRODUCT_EXPORT_ASSETS_MAX_ROWS) {
    throw new Error(
      `Export s tiskovými daty / softproofem je omezen na ${PRODUCT_EXPORT_ASSETS_MAX_ROWS} unikátních produktů (nalezeno ${uniqueProducts.length}). Zúžte výběr.`
    );
  }

  const { files, paths } = await collectProductExportAssets(uniqueProducts, assetOpts);

  const rendered = renderOrderLineExport(format, rows, columns, assetOpts, paths);
  const tableBuffer = Buffer.from(
    format === "csv" ? "\uFEFF" + rendered.body : rendered.body,
    "utf-8"
  );

  const stamp = new Date().toISOString().slice(0, 10);
  const zip = await buildProductExportZip({
    tableBuffer,
    tableFilename: rendered.filename,
    assets: files,
    zipFilename: `iml-objednavky-${stamp}.zip`,
    manifest: {
      exportedAt: new Date().toISOString(),
      rowCount: rows.length,
      assetCount: files.length,
      includePrint: assetOpts.includePrint,
      includeSoftproof: assetOpts.includeSoftproof,
    },
  });

  return { kind: "zip", buffer: zip.buffer, filename: zip.filename, exportedOrderIds };
}
