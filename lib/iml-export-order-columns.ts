import { escapeXml } from "@/lib/iml-xml";
import { escapeCsv } from "@/lib/iml-export";
import {
  PRODUCT_EXPORT_FIELD_DEFS,
  productFieldFromOrderKey,
  productFieldOrderKey,
  serializeProductFieldValue,
  type ProductExportSourceRow,
} from "@/lib/iml-export-product-field-catalog";

export type OrderExportColumnGroup = "order" | "line" | "product";

const ORDER_HEADER_COLUMNS = [
  { key: "order_id", label: "ID objednávky", defaultSelected: false },
  { key: "order_number", label: "Číslo objednávky", defaultSelected: true },
  { key: "job_number", label: "Číslo zakázky", defaultSelected: true },
  { key: "customer_name", label: "Zákazník", defaultSelected: true },
  { key: "order_date", label: "Datum přijetí", defaultSelected: true },
  { key: "expected_ship_date", label: "Plánovaná expedice", defaultSelected: true },
  { key: "status", label: "Stav objednávky", defaultSelected: true },
  { key: "total", label: "Celkem (Kč)", defaultSelected: false },
  { key: "notes", label: "Poznámky", defaultSelected: false },
  { key: "shipping_label", label: "Doručení – označení", defaultSelected: false },
  { key: "shipping_recipient", label: "Doručení – příjemce", defaultSelected: false },
  { key: "shipping_street", label: "Doručení – ulice", defaultSelected: false },
  { key: "shipping_city", label: "Doručení – město", defaultSelected: false },
  { key: "shipping_postal_code", label: "Doručení – PSČ", defaultSelected: false },
  { key: "shipping_country", label: "Doručení – země", defaultSelected: false },
  { key: "order_created_at", label: "Objednávka vytvořena", defaultSelected: false },
] as const;

const LINE_COLUMNS = [
  { key: "line_id", label: "ID řádku", defaultSelected: false },
  { key: "quantity", label: "Množství", defaultSelected: true },
  { key: "unit_price", label: "Jedn. cena", defaultSelected: true },
  { key: "subtotal", label: "Mezisoučet", defaultSelected: true },
] as const;

const PRODUCT_COLUMNS_FROM_CATALOG = PRODUCT_EXPORT_FIELD_DEFS.map((def) => ({
  key: productFieldOrderKey(def.key),
  label: def.key === "id" ? "ID produktu" : def.label,
  defaultSelected: def.defaultSelected,
}));

export const ORDER_LINE_EXPORT_COLUMNS: Array<{
  key: string;
  label: string;
  group: OrderExportColumnGroup;
  defaultSelected?: boolean;
}> = [
  ...ORDER_HEADER_COLUMNS.map((c) => ({ ...c, group: "order" as const })),
  ...LINE_COLUMNS.map((c) => ({ ...c, group: "line" as const })),
  ...PRODUCT_COLUMNS_FROM_CATALOG.map((c) => ({ ...c, group: "product" as const })),
];

export const ORDER_LINE_EXPORT_COLUMN_KEYS = ORDER_LINE_EXPORT_COLUMNS.map(
  (c) => c.key
) as readonly string[];

export type OrderLineExportColumnKey = (typeof ORDER_LINE_EXPORT_COLUMN_KEYS)[number];

export type OrderLineExportColumnDef = {
  key: OrderLineExportColumnKey;
  label: string;
  group: OrderExportColumnGroup;
  defaultSelected?: boolean;
};

export const ORDER_EXPORT_COLUMN_GROUPS: Array<{ id: OrderExportColumnGroup; label: string }> =
  [
    { id: "order", label: "Hlavička objednávky" },
    { id: "line", label: "Řádek" },
    { id: "product", label: "Produkt" },
  ];

export const DEFAULT_ORDER_LINE_EXPORT_COLUMNS: OrderLineExportColumnKey[] =
  ORDER_LINE_EXPORT_COLUMNS.filter((c) => c.defaultSelected).map(
    (c) => c.key as OrderLineExportColumnKey
  );

const KEY_SET = new Set<string>(ORDER_LINE_EXPORT_COLUMN_KEYS);

export function isOrderLineExportColumnKey(key: string): key is OrderLineExportColumnKey {
  return KEY_SET.has(key);
}

export function orderLineExportColumnGroup(key: OrderLineExportColumnKey): OrderExportColumnGroup {
  return ORDER_LINE_EXPORT_COLUMNS.find((c) => c.key === key)?.group ?? "order";
}

export function sanitizeOrderExportColumns(
  input: unknown
): Array<{ key: OrderLineExportColumnKey; header?: string }> {
  if (!Array.isArray(input)) return DEFAULT_ORDER_LINE_EXPORT_COLUMNS.map((key) => ({ key }));
  const out: Array<{ key: OrderLineExportColumnKey; header?: string }> = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item === "string" && isOrderLineExportColumnKey(item) && !seen.has(item)) {
      seen.add(item);
      out.push({ key: item });
      continue;
    }
    if (item && typeof item === "object" && "key" in item) {
      const key = String((item as { key: unknown }).key);
      if (!isOrderLineExportColumnKey(key) || seen.has(key)) continue;
      seen.add(key);
      const header =
        typeof (item as { header?: unknown }).header === "string"
          ? (item as { header: string }).header.trim().slice(0, 100) || undefined
          : undefined;
      out.push(header ? { key, header } : { key });
    }
  }
  return out.length > 0 ? out : DEFAULT_ORDER_LINE_EXPORT_COLUMNS.map((key) => ({ key }));
}

export type OrderExportFilters = {
  search?: string;
  customer_id?: number | null;
  status?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  order_ids?: number[];
  include_print?: boolean;
  include_softproof?: boolean;
};

function truthyExportAssetFlag(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true";
}

export function sanitizeOrderExportFilters(input: unknown): OrderExportFilters {
  if (!input || typeof input !== "object") return {};
  const o = input as Record<string, unknown>;
  const filters: OrderExportFilters = {};
  if (typeof o.search === "string" && o.search.trim()) filters.search = o.search.trim();
  if (o.customer_id != null && o.customer_id !== "") {
    const n = parseInt(String(o.customer_id), 10);
    if (!Number.isNaN(n)) filters.customer_id = n;
  }
  if (typeof o.status === "string" && o.status.trim()) filters.status = o.status.trim();
  if (typeof o.date_from === "string" && /^\d{4}-\d{2}-\d{2}/.test(o.date_from)) {
    filters.date_from = o.date_from.slice(0, 10);
  }
  if (typeof o.date_to === "string" && /^\d{4}-\d{2}-\d{2}/.test(o.date_to)) {
    filters.date_to = o.date_to.slice(0, 10);
  }
  if (Array.isArray(o.order_ids)) {
    const ids = o.order_ids
      .map((x) => parseInt(String(x), 10))
      .filter((n) => !Number.isNaN(n) && n > 0)
      .slice(0, 500);
    if (ids.length) filters.order_ids = [...new Set(ids)];
  }
  if (truthyExportAssetFlag(o.include_print)) filters.include_print = true;
  if (truthyExportAssetFlag(o.include_softproof)) filters.include_softproof = true;
  return filters;
}

export function orderColumnHeader(
  col: { key: OrderLineExportColumnKey; header?: string },
  catalog = ORDER_LINE_EXPORT_COLUMNS
): string {
  if (col.header) return col.header;
  return catalog.find((c) => c.key === col.key)?.label ?? col.key;
}

function fmtDate(v: Date | string | null | undefined): string {
  if (v == null || v === "") return "";
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function fmtDecimal(v: unknown): string {
  if (v == null || v === "") return "";
  return String(v);
}

export type OrderLineExportSourceRow = {
  order_id: number;
  order_number: string;
  job_number: string | null;
  customer_name: string;
  order_date: Date;
  expected_ship_date: Date | null;
  status: string;
  total: unknown;
  notes: string | null;
  shipping_snapshot_label: string | null;
  shipping_snapshot_recipient: string | null;
  shipping_snapshot_street: string | null;
  shipping_snapshot_city: string | null;
  shipping_snapshot_postal_code: string | null;
  shipping_snapshot_country: string | null;
  order_created_at: Date;
  line_id: number;
  quantity: number;
  unit_price: unknown;
  subtotal: unknown;
  product_id: number | null;
  product_data: ProductExportSourceRow | null;
  image_data?: Buffer | null;
};

export function serializeOrderLineExportValue(
  row: OrderLineExportSourceRow,
  key: OrderLineExportColumnKey
): string {
  switch (key) {
    case "order_id":
      return String(row.order_id);
    case "order_number":
      return row.order_number ?? "";
    case "job_number":
      return row.job_number ?? "";
    case "customer_name":
      return row.customer_name ?? "";
    case "order_date":
      return fmtDate(row.order_date);
    case "expected_ship_date":
      return fmtDate(row.expected_ship_date);
    case "status":
      return row.status ?? "";
    case "total":
      return fmtDecimal(row.total);
    case "notes":
      return row.notes ?? "";
    case "shipping_label":
      return row.shipping_snapshot_label ?? "";
    case "shipping_recipient":
      return row.shipping_snapshot_recipient ?? "";
    case "shipping_street":
      return row.shipping_snapshot_street ?? "";
    case "shipping_city":
      return row.shipping_snapshot_city ?? "";
    case "shipping_postal_code":
      return row.shipping_snapshot_postal_code ?? "";
    case "shipping_country":
      return row.shipping_snapshot_country ?? "";
    case "order_created_at":
      return fmtDate(row.order_created_at);
    case "line_id":
      return String(row.line_id);
    case "quantity":
      return String(row.quantity);
    case "unit_price":
      return fmtDecimal(row.unit_price);
    case "subtotal":
      return fmtDecimal(row.subtotal);
    case "product_id":
      return row.product_id != null ? String(row.product_id) : "";
    default: {
      const productKey = productFieldFromOrderKey(key);
      if (productKey) {
        return serializeProductFieldValue(row.product_data, productKey);
      }
      return "";
    }
  }
}

export function buildOrderLineExportXml(
  rows: OrderLineExportSourceRow[],
  columns: Array<{ key: OrderLineExportColumnKey; header?: string }>
): string {
  const orderCols = columns.filter((c) => orderLineExportColumnGroup(c.key) === "order");
  const itemCols = columns.filter((c) => orderLineExportColumnGroup(c.key) !== "order");

  const byOrder = new Map<number, OrderLineExportSourceRow[]>();
  for (const row of rows) {
    const list = byOrder.get(row.order_id) ?? [];
    list.push(row);
    byOrder.set(row.order_id, list);
  }

  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', "<Orders>"];
  for (const orderRows of byOrder.values()) {
    const first = orderRows[0]!;
    lines.push("  <Order>");
    for (const col of orderCols) {
      const val = serializeOrderLineExportValue(first, col.key);
      lines.push(`    <${col.key}>${escapeXml(val)}</${col.key}>`);
    }
    if (itemCols.length > 0) {
      lines.push("    <Items>");
      for (const row of orderRows) {
        lines.push("      <Item>");
        for (const col of itemCols) {
          const val = serializeOrderLineExportValue(row, col.key);
          lines.push(`        <${col.key}>${escapeXml(val)}</${col.key}>`);
        }
        lines.push("      </Item>");
      }
      lines.push("    </Items>");
    }
    lines.push("  </Order>");
  }
  lines.push("</Orders>");
  return lines.join("\n");
}

export function buildOrderLineExportCsv(
  rows: OrderLineExportSourceRow[],
  columns: Array<{ key: OrderLineExportColumnKey; header?: string }>
): string {
  const header = columns.map((c) => escapeCsv(orderColumnHeader(c))).join(";");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsv(serializeOrderLineExportValue(row, c.key))).join(";")
  );
  return [header, ...lines].join("\n");
}

export function buildOrderLineExportCsvWithAssetPaths(
  rows: OrderLineExportSourceRow[],
  columns: Array<{ key: OrderLineExportColumnKey; header?: string }>,
  assetPaths: Map<number, { soubor_tisk?: string; soubor_softproof?: string }>,
  assetOpts: { includePrint: boolean; includeSoftproof: boolean }
): string {
  const extraHeaders: string[] = [];
  if (assetOpts.includePrint) extraHeaders.push("soubor_tisk");
  if (assetOpts.includeSoftproof) extraHeaders.push("soubor_softproof");

  const header = [
    ...columns.map((c) => escapeCsv(orderColumnHeader(c))),
    ...extraHeaders.map((h) => escapeCsv(h)),
  ].join(";");

  const lines = rows.map((row) => {
    const base = columns
      .map((c) => escapeCsv(serializeOrderLineExportValue(row, c.key)))
      .join(";");
    const extras: string[] = [];
    const pid = row.product_id;
    if (assetOpts.includePrint) {
      extras.push(escapeCsv(pid != null ? (assetPaths.get(pid)?.soubor_tisk ?? "") : ""));
    }
    if (assetOpts.includeSoftproof) {
      extras.push(escapeCsv(pid != null ? (assetPaths.get(pid)?.soubor_softproof ?? "") : ""));
    }
    return extras.length ? `${base};${extras.join(";")}` : base;
  });

  return [header, ...lines].join("\n");
}

export function buildOrderLineExportXmlWithAssetPaths(
  rows: OrderLineExportSourceRow[],
  columns: Array<{ key: OrderLineExportColumnKey; header?: string }>,
  assetPaths: Map<number, { soubor_tisk?: string; soubor_softproof?: string }>,
  assetOpts: { includePrint: boolean; includeSoftproof: boolean }
): string {
  const orderCols = columns.filter((c) => orderLineExportColumnGroup(c.key) === "order");
  const itemCols = columns.filter((c) => orderLineExportColumnGroup(c.key) !== "order");

  const byOrder = new Map<number, OrderLineExportSourceRow[]>();
  for (const row of rows) {
    const list = byOrder.get(row.order_id) ?? [];
    list.push(row);
    byOrder.set(row.order_id, list);
  }

  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', "<Orders>"];
  for (const orderRows of byOrder.values()) {
    const first = orderRows[0]!;
    lines.push("  <Order>");
    for (const col of orderCols) {
      const val = serializeOrderLineExportValue(first, col.key);
      lines.push(`    <${col.key}>${escapeXml(val)}</${col.key}>`);
    }
    if (itemCols.length > 0 || assetOpts.includePrint || assetOpts.includeSoftproof) {
      lines.push("    <Items>");
      for (const row of orderRows) {
        lines.push("      <Item>");
        for (const col of itemCols) {
          const val = serializeOrderLineExportValue(row, col.key);
          lines.push(`        <${col.key}>${escapeXml(val)}</${col.key}>`);
        }
        const pid = row.product_id;
        if (assetOpts.includePrint) {
          lines.push(
            `        <soubor_tisk>${escapeXml(pid != null ? (assetPaths.get(pid)?.soubor_tisk ?? "") : "")}</soubor_tisk>`
          );
        }
        if (assetOpts.includeSoftproof) {
          lines.push(
            `        <soubor_softproof>${escapeXml(pid != null ? (assetPaths.get(pid)?.soubor_softproof ?? "") : "")}</soubor_softproof>`
          );
        }
        lines.push("      </Item>");
      }
      lines.push("    </Items>");
    }
    lines.push("  </Order>");
  }
  lines.push("</Orders>");
  return lines.join("\n");
}
