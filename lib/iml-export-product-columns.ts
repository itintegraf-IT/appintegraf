import { escapeXml } from "@/lib/iml-xml";
import { escapeCsv } from "@/lib/iml-export";

/** Whitelist klíčů exportu produktů (bezpečnost — žádné libovolné SQL). */
export const PRODUCT_EXPORT_COLUMN_KEYS = [
  "id",
  "ig_code",
  "ig_short_name",
  "client_code",
  "client_name",
  "sku",
  "product_kind",
  "customer_name",
  "requester",
  "label_shape_code",
  "product_format",
  "format_width_mm",
  "format_height_mm",
  "die_cut_tool_code",
  "assembly_code",
  "positions_on_sheet",
  "labels_per_sheet",
  "pieces_per_box",
  "pieces_per_pallet",
  "foil_type",
  "color_coverage",
  "ean_code",
  "item_status",
  "approval_status",
  "approval_date",
  "color_count",
  "print_colors_text",
  "pantone_codes",
  "label_type",
  "has_print_sample",
  "has_print_proof",
  "is_active",
  "archived_at",
  "created_at",
  "updated_at",
] as const;

export type ProductExportColumnKey = (typeof PRODUCT_EXPORT_COLUMN_KEYS)[number];

export type ProductExportColumnDef = {
  key: ProductExportColumnKey;
  label: string;
  defaultSelected?: boolean;
};

export const PRODUCT_EXPORT_COLUMNS: ProductExportColumnDef[] = [
  { key: "id", label: "ID", defaultSelected: true },
  { key: "ig_code", label: "Kód IG", defaultSelected: true },
  { key: "ig_short_name", label: "Zkrácený název", defaultSelected: true },
  { key: "client_code", label: "Kód klienta", defaultSelected: true },
  { key: "client_name", label: "Název klienta", defaultSelected: true },
  { key: "sku", label: "SKU" },
  { key: "product_kind", label: "Druh produktu", defaultSelected: true },
  { key: "customer_name", label: "Zákazník", defaultSelected: true },
  { key: "requester", label: "Žadatel" },
  { key: "label_shape_code", label: "Tvar etikety" },
  { key: "product_format", label: "Formát" },
  { key: "format_width_mm", label: "Šířka (mm)" },
  { key: "format_height_mm", label: "Výška (mm)" },
  { key: "die_cut_tool_code", label: "Výsek" },
  { key: "assembly_code", label: "Sestava" },
  { key: "positions_on_sheet", label: "Pozic na archu" },
  { key: "labels_per_sheet", label: "Etiket na arch" },
  { key: "pieces_per_box", label: "Ks / krabice" },
  { key: "pieces_per_pallet", label: "Ks / paleta" },
  { key: "foil_type", label: "Fólie" },
  { key: "color_coverage", label: "Pokrytí barev" },
  { key: "ean_code", label: "EAN" },
  { key: "item_status", label: "Stav položky", defaultSelected: true },
  { key: "approval_status", label: "Stav schválení" },
  { key: "approval_date", label: "Datum schválení" },
  { key: "color_count", label: "Počet barev" },
  { key: "print_colors_text", label: "Barvy (souhrn)" },
  { key: "pantone_codes", label: "Pantone kódy" },
  { key: "label_type", label: "Typ etikety" },
  { key: "has_print_sample", label: "Tiskový vzorek" },
  { key: "has_print_proof", label: "Nátisk" },
  { key: "is_active", label: "Aktivní" },
  { key: "archived_at", label: "Archivováno" },
  { key: "created_at", label: "Vytvořeno" },
  { key: "updated_at", label: "Upraveno", defaultSelected: true },
];

export const DEFAULT_PRODUCT_EXPORT_COLUMNS: ProductExportColumnKey[] =
  PRODUCT_EXPORT_COLUMNS.filter((c) => c.defaultSelected).map((c) => c.key);

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

function fmtDate(v: Date | string | null | undefined): string {
  if (v == null || v === "") return "";
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function fmtBool(v: boolean | null | undefined): string {
  if (v == null) return "";
  return v ? "ano" : "ne";
}

export type ProductExportSourceRow = {
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
  labels_per_sheet: number | null;
  pieces_per_box: number | null;
  pieces_per_pallet: number | null;
  foil_type: string | null;
  color_coverage: string | null;
  ean_code: string | null;
  item_status: string | null;
  approval_status: string | null;
  approval_date: Date | null;
  color_count: number | null;
  print_colors_text: string | null;
  label_type: string | null;
  has_print_sample: boolean;
  has_print_proof: boolean;
  is_active: boolean;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
  iml_customers?: { name: string } | null;
  iml_product_colors?: Array<{ iml_pantone_colors?: { code: string | null } | null }>;
};

export function serializeProductExportValue(
  row: ProductExportSourceRow,
  key: ProductExportColumnKey
): string {
  switch (key) {
    case "id":
      return String(row.id);
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
    case "customer_name":
      return row.iml_customers?.name ?? "";
    case "requester":
      return row.requester ?? "";
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
    case "assembly_code":
      return row.assembly_code ?? "";
    case "positions_on_sheet":
      return row.positions_on_sheet != null ? String(row.positions_on_sheet) : "";
    case "labels_per_sheet":
      return row.labels_per_sheet != null ? String(row.labels_per_sheet) : "";
    case "pieces_per_box":
      return row.pieces_per_box != null ? String(row.pieces_per_box) : "";
    case "pieces_per_pallet":
      return row.pieces_per_pallet != null ? String(row.pieces_per_pallet) : "";
    case "foil_type":
      return row.foil_type ?? "";
    case "color_coverage":
      return row.color_coverage ?? "";
    case "ean_code":
      return row.ean_code ?? "";
    case "item_status":
      return row.item_status ?? "";
    case "approval_status":
      return row.approval_status ?? "";
    case "approval_date":
      return fmtDate(row.approval_date);
    case "color_count":
      return row.color_count != null ? String(row.color_count) : "";
    case "print_colors_text":
      return row.print_colors_text ?? "";
    case "pantone_codes":
      return (row.iml_product_colors ?? [])
        .map((c) => c.iml_pantone_colors?.code)
        .filter(Boolean)
        .join(", ");
    case "label_type":
      return row.label_type ?? "";
    case "has_print_sample":
      return fmtBool(row.has_print_sample);
    case "has_print_proof":
      return fmtBool(row.has_print_proof);
    case "is_active":
      return fmtBool(row.is_active);
    case "archived_at":
      return fmtDate(row.archived_at);
    case "created_at":
      return fmtDate(row.created_at);
    case "updated_at":
      return fmtDate(row.updated_at);
    default:
      return "";
  }
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
