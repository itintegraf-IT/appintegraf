import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  buildOrderLineExportCsv,
  buildOrderLineExportXml,
  sanitizeOrderExportColumns,
  sanitizeOrderExportFilters,
  type OrderExportFilters,
  type OrderLineExportColumnKey,
  type OrderLineExportSourceRow,
} from "@/lib/iml-export-order-columns";

const MAX_ORDERS = 2000;

export async function loadOrderLinesForExport(
  filtersInput: unknown,
  columnsInput: unknown
): Promise<{
  rows: OrderLineExportSourceRow[];
  columns: Array<{ key: OrderLineExportColumnKey; header?: string }>;
  filters: OrderExportFilters;
}> {
  const columns = sanitizeOrderExportColumns(columnsInput);
  const filters = sanitizeOrderExportFilters(filtersInput);

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
            select: {
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
            },
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
      const p = item.iml_products;
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
        ig_code: p?.ig_code ?? null,
        ig_short_name: p?.ig_short_name ?? null,
        client_code: p?.client_code ?? null,
        client_name: p?.client_name ?? null,
        sku: p?.sku ?? null,
        product_kind: p?.product_kind ?? null,
        label_shape_code: p?.label_shape_code ?? null,
        product_format: p?.product_format ?? null,
        format_width_mm: p?.format_width_mm ?? null,
        format_height_mm: p?.format_height_mm ?? null,
        die_cut_tool_code: p?.die_cut_tool_code ?? null,
        foil_type: p?.foil_type ?? null,
        ean_code: p?.ean_code ?? null,
        item_status: p?.item_status ?? null,
        print_colors_text: p?.print_colors_text ?? null,
        color_count: p?.color_count ?? null,
        pantone_codes: pantone,
      });
    }
  }

  return { rows, columns, filters };
}

export function renderOrderLineExport(
  format: "csv" | "xml",
  rows: OrderLineExportSourceRow[],
  columns: Array<{ key: OrderLineExportColumnKey; header?: string }>
): { body: string; contentType: string; filename: string } {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "xml") {
    return {
      body: buildOrderLineExportXml(rows, columns),
      contentType: "application/xml; charset=utf-8",
      filename: `iml-objednavky-${stamp}.xml`,
    };
  }
  return {
    body: buildOrderLineExportCsv(rows, columns),
    contentType: "text/csv; charset=utf-8",
    filename: `iml-objednavky-${stamp}.csv`,
  };
}
