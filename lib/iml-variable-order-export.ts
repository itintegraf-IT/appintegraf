import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { OrderExportField } from "@/lib/iml-order-export-fields";

export type { OrderExportField } from "@/lib/iml-order-export-fields";
export {
  ORDER_EXPORT_FIELDS,
  ORDER_EXPORT_FIELD_LABELS,
  normalizeOrderExportFields,
  ordersToFlatXml,
  pickOrderExportRow,
} from "@/lib/iml-order-export-fields";

export type OrderForVariableExport = Prisma.iml_ordersGetPayload<{
  include: {
    iml_customers: { select: { name: true } };
    iml_order_items: {
      orderBy: { id: "asc" };
      include: {
        iml_products: {
          select: {
            ig_code: true;
            client_name: true;
            iml_product_colors: {
              orderBy: { sort_order: "asc" };
              select: { iml_pantone_colors: { select: { code: true } } };
            };
          };
        };
      };
    };
  };
}>;

export async function fetchOrdersForVariableExport(
  where: Prisma.iml_ordersWhereInput
): Promise<OrderForVariableExport[]> {
  return prisma.iml_orders.findMany({
    where,
    orderBy: { order_date: "desc" },
    take: 2000,
    include: {
      iml_customers: { select: { name: true } },
      iml_order_items: {
        orderBy: { id: "asc" },
        include: {
          iml_products: {
            select: {
              ig_code: true,
              client_name: true,
              iml_product_colors: {
                orderBy: { sort_order: "asc" },
                select: { iml_pantone_colors: { select: { code: true } } },
              },
            },
          },
        },
      },
    },
  });
}

export function buildOrderExportFullRow(o: OrderForVariableExport): Record<OrderExportField, string> {
  const pantone = new Set<string>();
  const parts: string[] = [];
  for (const it of o.iml_order_items) {
    const p = it.iml_products;
    const label = p?.ig_code ?? p?.client_name ?? "?";
    parts.push(`${label}:${it.quantity}`);
    for (const c of p?.iml_product_colors ?? []) {
      const code = c.iml_pantone_colors?.code?.trim();
      if (code) pantone.add(code);
    }
  }
  const pantone_codes = [...pantone].sort((a, b) => a.localeCompare(b, "cs")).join(", ");
  return {
    id: String(o.id),
    order_number: o.order_number ?? "",
    customer_name: o.iml_customers?.name ?? "",
    order_date: o.order_date ? new Date(o.order_date).toISOString().slice(0, 10) : "",
    expected_ship_date: o.expected_ship_date
      ? new Date(o.expected_ship_date).toISOString().slice(0, 10)
      : "",
    status: o.status ?? "",
    total: o.total != null ? String(o.total) : "",
    notes: (o.notes ?? "").replace(/\r\n/g, "\n"),
    items_count: String(o.iml_order_items.length),
    items_summary: parts.join("; "),
    items_detail: parts.join(" | "),
    pantone_codes,
    created_at: o.created_at ? new Date(o.created_at).toISOString().slice(0, 10) : "",
    updated_at: o.updated_at ? new Date(o.updated_at).toISOString().slice(0, 10) : "",
  };
}
