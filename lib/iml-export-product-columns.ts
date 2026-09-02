import { escapeXml } from "@/lib/iml-xml";
import { escapeCsv } from "@/lib/iml-export";
import {
  DEFAULT_PRODUCT_EXPORT_FIELD_KEYS,
  isProductExportFieldKey,
  PRODUCT_EXPORT_FIELD_DEFS,
  PRODUCT_EXPORT_FIELD_GROUPS,
  PRODUCT_EXPORT_FIELD_KEYS,
  serializeProductFieldValue,
  type ProductExportFieldGroup,
  type ProductExportFieldKey,
  type ProductExportSourceRow,
} from "@/lib/iml-export-product-field-catalog";

export type { ProductExportFieldGroup, ProductExportSourceRow };
export { PRODUCT_EXPORT_FIELD_GROUPS };

/** Whitelist klíčů exportu produktů (bezpečnost — žádné libovolné SQL). */
export const PRODUCT_EXPORT_COLUMN_KEYS = PRODUCT_EXPORT_FIELD_KEYS;

export type ProductExportColumnKey = ProductExportFieldKey;

export type ProductExportColumnDef = {
  key: ProductExportColumnKey;
  label: string;
  group: ProductExportFieldGroup;
  defaultSelected?: boolean;
};

export const PRODUCT_EXPORT_COLUMNS: ProductExportColumnDef[] = PRODUCT_EXPORT_FIELD_DEFS.map(
  (d) => ({
    key: d.key,
    label: d.label,
    group: d.group,
    defaultSelected: d.defaultSelected,
  })
);

export const DEFAULT_PRODUCT_EXPORT_COLUMNS: ProductExportColumnKey[] = [
  ...DEFAULT_PRODUCT_EXPORT_FIELD_KEYS,
];

const KEY_SET = new Set<string>(PRODUCT_EXPORT_COLUMN_KEYS);

export function isProductExportColumnKey(key: string): key is ProductExportColumnKey {
  return KEY_SET.has(key);
}

export function sanitizeProductExportColumns(
  input: unknown
): Array<{ key: ProductExportColumnKey; header?: string }> {
  if (!Array.isArray(input)) return DEFAULT_PRODUCT_EXPORT_COLUMNS.map((key) => ({ key }));
  const out: Array<{ key: ProductExportColumnKey; header?: string }> = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item === "string" && isProductExportColumnKey(item) && !seen.has(item)) {
      seen.add(item);
      out.push({ key: item });
      continue;
    }
    if (item && typeof item === "object" && "key" in item) {
      const key = String((item as { key: unknown }).key);
      if (!isProductExportColumnKey(key) || seen.has(key)) continue;
      seen.add(key);
      const header =
        typeof (item as { header?: unknown }).header === "string"
          ? (item as { header: string }).header.trim().slice(0, 100) || undefined
          : undefined;
      out.push(header ? { key, header } : { key });
    }
  }
  return out.length > 0 ? out : DEFAULT_PRODUCT_EXPORT_COLUMNS.map((key) => ({ key }));
}

export type ProductExportFilters = {
  search?: string;
  customer_id?: number | null;
  item_status?: string | null;
  product_kind?: string | null;
  /** active | archived | all */
  archive?: string | null;
  include_print?: boolean;
  include_softproof?: boolean;
};

function truthyExportAssetFlag(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true";
}

export function sanitizeProductExportFilters(input: unknown): ProductExportFilters {
  if (!input || typeof input !== "object") return {};
  const o = input as Record<string, unknown>;
  const filters: ProductExportFilters = {};
  if (typeof o.search === "string" && o.search.trim()) filters.search = o.search.trim();
  if (o.customer_id != null && o.customer_id !== "") {
    const n = parseInt(String(o.customer_id), 10);
    if (!Number.isNaN(n)) filters.customer_id = n;
  }
  if (typeof o.item_status === "string" && o.item_status.trim()) {
    filters.item_status = o.item_status.trim();
  } else if (typeof o.status === "string" && o.status.trim()) {
    filters.item_status = o.status.trim();
  }
  if (o.product_kind === "iml" || o.product_kind === "etikety") {
    filters.product_kind = o.product_kind;
  }
  if (o.archive === "archived" || o.archive === "all" || o.archive === "active") {
    filters.archive = o.archive;
  }
  if (truthyExportAssetFlag(o.include_print)) filters.include_print = true;
  if (truthyExportAssetFlag(o.include_softproof)) filters.include_softproof = true;
  return filters;
}

export function columnHeader(
  col: { key: ProductExportColumnKey; header?: string },
  catalog = PRODUCT_EXPORT_COLUMNS
): string {
  if (col.header) return col.header;
  return catalog.find((c) => c.key === col.key)?.label ?? col.key;
}

export function serializeProductExportValue(
  row: ProductExportSourceRow,
  key: ProductExportColumnKey
): string {
  return serializeProductFieldValue(row, key);
}

export function buildProductExportCsv(
  rows: ProductExportSourceRow[],
  columns: Array<{ key: ProductExportColumnKey; header?: string }>
): string {
  const header = columns.map((c) => escapeCsv(columnHeader(c))).join(";");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsv(serializeProductExportValue(row, c.key))).join(";")
  );
  return [header, ...lines].join("\n");
}

export function buildProductExportCsvWithAssetPaths(
  rows: ProductExportSourceRow[],
  columns: Array<{ key: ProductExportColumnKey; header?: string }>,
  assetPaths: Map<number, { soubor_tisk?: string; soubor_softproof?: string }>,
  assetOpts: { includePrint: boolean; includeSoftproof: boolean }
): string {
  const extraHeaders: string[] = [];
  if (assetOpts.includePrint) extraHeaders.push("soubor_tisk");
  if (assetOpts.includeSoftproof) extraHeaders.push("soubor_softproof");

  const header = [
    ...columns.map((c) => escapeCsv(columnHeader(c))),
    ...extraHeaders.map((h) => escapeCsv(h)),
  ].join(";");

  const lines = rows.map((row) => {
    const base = columns
      .map((c) => escapeCsv(serializeProductExportValue(row, c.key)))
      .join(";");
    const extras: string[] = [];
    if (assetOpts.includePrint) {
      extras.push(escapeCsv(assetPaths.get(row.id)?.soubor_tisk ?? ""));
    }
    if (assetOpts.includeSoftproof) {
      extras.push(escapeCsv(assetPaths.get(row.id)?.soubor_softproof ?? ""));
    }
    return extras.length ? `${base};${extras.join(";")}` : base;
  });

  return [header, ...lines].join("\n");
}

export function buildProductExportXmlWithAssetPaths(
  rows: ProductExportSourceRow[],
  columns: Array<{ key: ProductExportColumnKey; header?: string }>,
  assetPaths: Map<number, { soubor_tisk?: string; soubor_softproof?: string }>,
  assetOpts: { includePrint: boolean; includeSoftproof: boolean }
): string {
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', "<Products>"];
  for (const row of rows) {
    lines.push("  <Product>");
    for (const col of columns) {
      const tag = col.key;
      const val = serializeProductExportValue(row, col.key);
      lines.push(`    <${tag}>${escapeXml(val)}</${tag}>`);
    }
    if (assetOpts.includePrint) {
      lines.push(
        `    <soubor_tisk>${escapeXml(assetPaths.get(row.id)?.soubor_tisk ?? "")}</soubor_tisk>`
      );
    }
    if (assetOpts.includeSoftproof) {
      lines.push(
        `    <soubor_softproof>${escapeXml(assetPaths.get(row.id)?.soubor_softproof ?? "")}</soubor_softproof>`
      );
    }
    lines.push("  </Product>");
  }
  lines.push("</Products>");
  return lines.join("\n");
}

export function buildProductExportXml(
  rows: ProductExportSourceRow[],
  columns: Array<{ key: ProductExportColumnKey; header?: string }>
): string {
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', "<Products>"];
  for (const row of rows) {
    lines.push("  <Product>");
    for (const col of columns) {
      const tag = col.key;
      const val = serializeProductExportValue(row, col.key);
      lines.push(`    <${tag}>${escapeXml(val)}</${tag}>`);
    }
    lines.push("  </Product>");
  }
  lines.push("</Products>");
  return lines.join("\n");
}

export { isProductExportFieldKey };
