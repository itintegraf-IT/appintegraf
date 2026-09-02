import { escapeXml } from "@/lib/iml-xml";
import { escapeCsv } from "@/lib/iml-export";

export type OrderExportColumnGroup = "order" | "line" | "product";

/** Whitelist klíčů line-level exportu objednávek. */
export const ORDER_LINE_EXPORT_COLUMN_KEYS = [
  // order header
  "order_id",
  "order_number",
  "job_number",
  "customer_name",
  "order_date",
  "expected_ship_date",
  "status",
  "total",
  "notes",
  "shipping_label",
  "shipping_recipient",
  "shipping_street",
  "shipping_city",
  "shipping_postal_code",
  "shipping_country",
  "order_created_at",
  // line
  "line_id",
  "quantity",
  "unit_price",
  "subtotal",
  // product
  "product_id",
  "ig_code",
  "ig_short_name",
  "client_code",
  "client_name",
  "sku",
  "product_kind",
  "label_shape_code",
  "product_format",
  "format_width_mm",
  "format_height_mm",
  "die_cut_tool_code",
  "foil_type",
  "ean_code",
  "item_status",
  "pantone_codes",
  "print_colors_text",
  "color_count",
] as const;

export type OrderLineExportColumnKey = (typeof ORDER_LINE_EXPORT_COLUMN_KEYS)[number];

export type OrderLineExportColumnDef = {
  key: OrderLineExportColumnKey;
  label: string;
  group: OrderExportColumnGroup;
  defaultSelected?: boolean;
};

export const ORDER_LINE_EXPORT_COLUMNS: OrderLineExportColumnDef[] = [
  { key: "order_id", label: "ID objednávky", group: "order" },
  { key: "order_number", label: "Číslo objednávky", group: "order", defaultSelected: true },
  { key: "job_number", label: "Číslo zakázky", group: "order", defaultSelected: true },
  { key: "customer_name", label: "Zákazník", group: "order", defaultSelected: true },
  { key: "order_date", label: "Datum přijetí", group: "order", defaultSelected: true },
  { key: "expected_ship_date", label: "Plánovaná expedice", group: "order", defaultSelected: true },
  { key: "status", label: "Stav objednávky", group: "order", defaultSelected: true },
  { key: "total", label: "Celkem (Kč)", group: "order" },
  { key: "notes", label: "Poznámky", group: "order" },
  { key: "shipping_label", label: "Doručení – označení", group: "order" },
  { key: "shipping_recipient", label: "Doručení – příjemce", group: "order" },
  { key: "shipping_street", label: "Doručení – ulice", group: "order" },
  { key: "shipping_city", label: "Doručení – město", group: "order" },
  { key: "shipping_postal_code", label: "Doručení – PSČ", group: "order" },
  { key: "shipping_country", label: "Doručení – země", group: "order" },
  { key: "order_created_at", label: "Objednávka vytvořena", group: "order" },

  { key: "line_id", label: "ID řádku", group: "line" },
  { key: "quantity", label: "Množství", group: "line", defaultSelected: true },
  { key: "unit_price", label: "Jedn. cena", group: "line", defaultSelected: true },
  { key: "subtotal", label: "Mezisoučet", group: "line", defaultSelected: true },

  { key: "product_id", label: "ID produktu", group: "product" },
  { key: "ig_code", label: "Kód IG", group: "product", defaultSelected: true },
  { key: "ig_short_name", label: "Zkrácený název", group: "product", defaultSelected: true },
  { key: "client_code", label: "Kód klienta", group: "product", defaultSelected: true },
  { key: "client_name", label: "Název klienta", group: "product", defaultSelected: true },
  { key: "sku", label: "SKU", group: "product" },
  { key: "product_kind", label: "Druh produktu", group: "product" },
  { key: "label_shape_code", label: "Tvar etikety", group: "product" },
  { key: "product_format", label: "Formát", group: "product" },
  { key: "format_width_mm", label: "Šířka (mm)", group: "product" },
  { key: "format_height_mm", label: "Výška (mm)", group: "product" },
  { key: "die_cut_tool_code", label: "Výsek", group: "product" },
  { key: "foil_type", label: "Fólie", group: "product" },
  { key: "ean_code", label: "EAN", group: "product" },
  { key: "item_status", label: "Stav položky", group: "product" },
  { key: "pantone_codes", label: "Pantone kódy", group: "product", defaultSelected: true },
  { key: "print_colors_text", label: "Barvy (souhrn)", group: "product" },
  { key: "color_count", label: "Počet barev", group: "product" },
];

export const ORDER_EXPORT_COLUMN_GROUPS: Array<{ id: OrderExportColumnGroup; label: string }> = [
  { id: "order", label: "Hlavička objednávky" },
  { id: "line", label: "Řádek" },
  { id: "product", label: "Produkt" },
];

export const DEFAULT_ORDER_LINE_EXPORT_COLUMNS: OrderLineExportColumnKey[] =
  ORDER_LINE_EXPORT_COLUMNS.filter((c) => c.defaultSelected).map((c) => c.key);

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
};

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
  ig_code: string | null;
  ig_short_name: string | null;
  client_code: string | null;
  client_name: string | null;
  sku: string | null;
  product_kind: string | null;
  label_shape_code: string | null;
  product_format: string | null;
  format_width_mm: unknown;
  format_height_mm: unknown;
  die_cut_tool_code: string | null;
  foil_type: string | null;
  ean_code: string | null;
  item_status: string | null;
  print_colors_text: string | null;
  color_count: number | null;
  pantone_codes: string;
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
    case "ig_code":
      return row.ig_code ?? "";
    case "ig_short_name":
      return row.ig_short_name ?? "";
    case "client_code":
      return row.client_code ?? "";
    case "client_name":
      return row.client_name ?? "";
    case "sku":
      return row.sku ?? "";
    case "product_kind":
      return row.product_kind ?? "";
    case "label_shape_code":
      return row.label_shape_code ?? "";
    case "product_format":
      return row.product_format ?? "";
    case "format_width_mm":
      return row.format_width_mm != null ? String(row.format_width_mm) : "";
    case "format_height_mm":
      return row.format_height_mm != null ? String(row.format_height_mm) : "";
    case "die_cut_tool_code":
      return row.die_cut_tool_code ?? "";
    case "foil_type":
      return row.foil_type ?? "";
    case "ean_code":
      return row.ean_code ?? "";
    case "item_status":
      return row.item_status ?? "";
    case "pantone_codes":
      return row.pantone_codes ?? "";
    case "print_colors_text":
      return row.print_colors_text ?? "";
    case "color_count":
      return row.color_count != null ? String(row.color_count) : "";
    default:
      return "";
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
