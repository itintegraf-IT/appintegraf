/**
 * Metadata sloupců seznamu IML produktů (bez JSX – render v ProductListColumnCells).
 */

export const PRODUCT_LIST_COLUMNS_STORAGE_KEY = "iml-products-visible-columns";
export const PRODUCT_LIST_COLUMN_WIDTHS_STORAGE_KEY = "iml-products-column-widths";
/** Klíč pro budoucí sync do DB (fáze 2). */
export const PRODUCT_LIST_COLUMNS_PREF_KEY = "iml_products_columns";
export const PRODUCT_LIST_COLUMN_WIDTHS_PREF_KEY = "iml_products_column_widths";
export const PRODUCT_LIST_COLUMNS_PREF_VERSION = 1 as const;

export const DEFAULT_MIN_COLUMN_WIDTH_PX = 48;
export const DEFAULT_MAX_COLUMN_WIDTH_PX = 480;

export type ProductListColumnId =
  | "ig_code"
  | "name"
  | "customer"
  | "product_kind"
  | "status"
  | "pdf"
  | "actions"
  | "thumbnail"
  | "sku"
  | "client_code"
  | "ig_short_name"
  | "requester"
  | "ean_code"
  | "die_cut_tool_code"
  | "label_shape_code"
  | "assembly_code"
  | "positions_on_sheet"
  | "labels_per_sheet"
  | "format"
  | "print_colors_text"
  | "color_count"
  | "color_coverage"
  | "foil"
  | "stock_quantity"
  | "approval_status"
  | "approval_date"
  | "updated_at";

export type ProductListColumnGroup =
  | "základ"
  | "identifikace"
  | "výseky"
  | "barvy"
  | "ostatní";

export type ProductListRow = {
  id: number;
  ig_code: string | null;
  ig_short_name: string | null;
  client_code: string | null;
  client_name: string | null;
  requester: string | null;
  label_shape_code: string | null;
  product_format: string | null;
  format_width_mm: number | string | null;
  format_height_mm: number | string | null;
  die_cut_tool_code: string | null;
  assembly_code: string | null;
  positions_on_sheet: number | null;
  labels_per_sheet: number | null;
  foil_type: string | null;
  color_coverage: string | null;
  color_count: number | null;
  print_colors_text: string | null;
  ean_code: string | null;
  approval_status: string | null;
  approval_date: string | Date | null;
  stock_quantity: number | null;
  sku: string | null;
  product_kind: string | null;
  item_status: string | null;
  updated_at: string | Date | null;
  iml_customers?: { id: number; name: string } | null;
  iml_foils?: { id: number; code: string | null; name: string | null } | null;
  has_image?: boolean;
  has_pdf?: boolean;
};

export type ProductListColumnWidths = Partial<Record<ProductListColumnId, number>>;

export type ProductListColumnMeta = {
  id: ProductListColumnId;
  label: string;
  group: ProductListColumnGroup;
  defaultVisible: boolean;
  defaultWidthPx: number;
  minWidthPx?: number;
  maxWidthPx?: number;
  resizable?: boolean;
  locked?: boolean;
  truncate?: boolean;
  headerClassName?: string;
  cellClassName?: string;
  align?: "left" | "center" | "right";
};

/** Preference sloupců – formát pro localStorage i budoucí API. */
export type ProductListColumnPrefs = {
  version: typeof PRODUCT_LIST_COLUMNS_PREF_VERSION;
  visibleColumnIds: ProductListColumnId[];
  columnWidths?: ProductListColumnWidths;
};

export const PRODUCT_LIST_COLUMN_GROUPS: Array<{
  id: ProductListColumnGroup;
  label: string;
}> = [
  { id: "základ", label: "Základ" },
  { id: "identifikace", label: "Identifikace" },
  { id: "výseky", label: "Výseky" },
  { id: "barvy", label: "Barvy / tisk" },
  { id: "ostatní", label: "Ostatní" },
];

export const PRODUCT_LIST_COLUMNS: ProductListColumnMeta[] = [
  { id: "ig_code", label: "Kód IG", group: "základ", defaultVisible: true, locked: true, defaultWidthPx: 110 },
  { id: "name", label: "Název / Klient", group: "základ", defaultVisible: true, locked: true, defaultWidthPx: 220, truncate: true },
  { id: "customer", label: "Zákazník", group: "základ", defaultVisible: true, defaultWidthPx: 180, truncate: true },
  { id: "product_kind", label: "Druh", group: "identifikace", defaultVisible: false, defaultWidthPx: 110 },
  { id: "status", label: "Stav", group: "základ", defaultVisible: true, defaultWidthPx: 90 },
  { id: "pdf", label: "PDF", group: "základ", defaultVisible: true, align: "center", defaultWidthPx: 56, minWidthPx: 48, maxWidthPx: 80, cellClassName: "text-center" },
  { id: "actions", label: "Akce", group: "základ", defaultVisible: true, locked: true, align: "right", defaultWidthPx: 120, minWidthPx: 96, maxWidthPx: 160 },
  { id: "thumbnail", label: "Náhled", group: "ostatní", defaultVisible: false, defaultWidthPx: 56, minWidthPx: 48, maxWidthPx: 80, cellClassName: "px-3 py-2" },
  { id: "sku", label: "SKU", group: "identifikace", defaultVisible: false, defaultWidthPx: 120, truncate: true },
  { id: "client_code", label: "Kód u klienta", group: "identifikace", defaultVisible: false, defaultWidthPx: 130, truncate: true },
  { id: "ig_short_name", label: "Zkrácený název IG", group: "identifikace", defaultVisible: false, defaultWidthPx: 160, truncate: true },
  { id: "requester", label: "Zadavatel", group: "identifikace", defaultVisible: false, defaultWidthPx: 140, truncate: true },
  { id: "ean_code", label: "EAN", group: "identifikace", defaultVisible: false, defaultWidthPx: 130, cellClassName: "font-mono text-sm" },
  { id: "die_cut_tool_code", label: "Výsekový nástroj", group: "výseky", defaultVisible: false, defaultWidthPx: 160, truncate: true },
  { id: "label_shape_code", label: "Kód tvaru etikety", group: "výseky", defaultVisible: false, defaultWidthPx: 140, truncate: true },
  { id: "assembly_code", label: "Montážní kód", group: "výseky", defaultVisible: false, defaultWidthPx: 130, truncate: true },
  { id: "positions_on_sheet", label: "Pozic na archu", group: "výseky", defaultVisible: false, align: "right", defaultWidthPx: 100 },
  { id: "labels_per_sheet", label: "Etiket na arch", group: "výseky", defaultVisible: false, align: "right", defaultWidthPx: 110 },
  { id: "format", label: "Formát", group: "výseky", defaultVisible: false, defaultWidthPx: 120 },
  { id: "print_colors_text", label: "Barvy (text)", group: "barvy", defaultVisible: false, defaultWidthPx: 180, truncate: true, cellClassName: "text-sm" },
  { id: "color_count", label: "Počet barev", group: "barvy", defaultVisible: false, align: "right", defaultWidthPx: 100 },
  { id: "color_coverage", label: "Pokrytí barev", group: "barvy", defaultVisible: false, defaultWidthPx: 120, truncate: true },
  { id: "foil", label: "Fólie", group: "barvy", defaultVisible: false, defaultWidthPx: 140, truncate: true },
  { id: "stock_quantity", label: "Sklad", group: "ostatní", defaultVisible: false, align: "right", defaultWidthPx: 80 },
  { id: "approval_status", label: "Schválení", group: "ostatní", defaultVisible: false, defaultWidthPx: 120, truncate: true },
  { id: "approval_date", label: "Datum schválení", group: "ostatní", defaultVisible: false, defaultWidthPx: 120 },
  { id: "updated_at", label: "Upraveno", group: "ostatní", defaultVisible: false, defaultWidthPx: 110, cellClassName: "text-sm text-gray-600 whitespace-nowrap" },
];

const columnById = new Map(PRODUCT_LIST_COLUMNS.map((c) => [c.id, c]));

export const LOCKED_COLUMN_IDS = PRODUCT_LIST_COLUMNS.filter((c) => c.locked).map((c) => c.id);

export const DEFAULT_VISIBLE_COLUMN_IDS = PRODUCT_LIST_COLUMNS.filter((c) => c.defaultVisible).map(
  (c) => c.id
);

export function getProductListColumnMeta(id: ProductListColumnId): ProductListColumnMeta | undefined {
  return columnById.get(id);
}

export function isKnownProductListColumnId(id: string): id is ProductListColumnId {
  return columnById.has(id as ProductListColumnId);
}

export function getDefaultColumnWidth(id: ProductListColumnId): number {
  return getProductListColumnMeta(id)?.defaultWidthPx ?? 120;
}

export function clampColumnWidth(id: ProductListColumnId, px: number): number {
  const meta = getProductListColumnMeta(id);
  const min = meta?.minWidthPx ?? DEFAULT_MIN_COLUMN_WIDTH_PX;
  const max = meta?.maxWidthPx ?? DEFAULT_MAX_COLUMN_WIDTH_PX;
  const rounded = Math.round(px);
  return Math.min(max, Math.max(min, rounded));
}

export function getDefaultColumnWidths(): ProductListColumnWidths {
  const widths: ProductListColumnWidths = {};
  for (const col of PRODUCT_LIST_COLUMNS) {
    widths[col.id] = col.defaultWidthPx;
  }
  return widths;
}

export function resolveColumnWidths(
  visibleIds: ProductListColumnId[],
  stored: ProductListColumnWidths | null | undefined
): ProductListColumnWidths {
  const result: ProductListColumnWidths = {};
  for (const id of visibleIds) {
    if (!isKnownProductListColumnId(id)) continue;
    const storedWidth = stored?.[id];
    result[id] =
      storedWidth != null && Number.isFinite(storedWidth)
        ? clampColumnWidth(id, storedWidth)
        : getDefaultColumnWidth(id);
  }
  return result;
}

export function parseStoredColumnWidths(raw: string | null): ProductListColumnWidths | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const widths: ProductListColumnWidths = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isKnownProductListColumnId(key)) continue;
      const num = Number(value);
      if (Number.isFinite(num)) {
        widths[key] = clampColumnWidth(key, num);
      }
    }
    return Object.keys(widths).length > 0 ? widths : null;
  } catch {
    return null;
  }
}

export function serializeColumnWidths(widths: ProductListColumnWidths): string {
  const clean: ProductListColumnWidths = {};
  for (const [key, value] of Object.entries(widths)) {
    if (!isKnownProductListColumnId(key)) continue;
    if (value != null && Number.isFinite(value)) {
      clean[key] = clampColumnWidth(key, value);
    }
  }
  return JSON.stringify(clean);
}

export function formatProductListFormat(row: ProductListRow): string {
  const w = row.format_width_mm;
  const h = row.format_height_mm;
  if (w != null && w !== "" && h != null && h !== "") {
    return `${w} × ${h} mm`;
  }
  return row.product_format?.trim() || "-";
}

export function formatProductListDate(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "-";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("cs-CZ");
}

export function formatProductListFoil(row: ProductListRow): string {
  const foil = row.iml_foils?.name ?? row.iml_foils?.code;
  if (foil) return foil;
  return row.foil_type?.trim() || "-";
}

/** Sestaví pořadí sloupců podle definice + uložené preference. */
export function resolveVisibleColumnIds(storedIds: ProductListColumnId[] | null): ProductListColumnId[] {
  const defaultSet = new Set(DEFAULT_VISIBLE_COLUMN_IDS);
  const chosen = new Set<ProductListColumnId>();

  for (const id of LOCKED_COLUMN_IDS) {
    chosen.add(id);
  }

  const source = storedIds && storedIds.length > 0 ? storedIds : DEFAULT_VISIBLE_COLUMN_IDS;
  for (const id of source) {
    if (isKnownProductListColumnId(id)) {
      chosen.add(id);
    }
  }

  if (!storedIds) {
    for (const id of defaultSet) chosen.add(id);
  }

  return PRODUCT_LIST_COLUMNS.filter((c) => chosen.has(c.id)).map((c) => c.id);
}

export function columnPrefsFromIds(ids: ProductListColumnId[]): ProductListColumnPrefs {
  return {
    version: PRODUCT_LIST_COLUMNS_PREF_VERSION,
    visibleColumnIds: resolveVisibleColumnIds(ids),
  };
}

export function parseStoredColumnPrefs(raw: string | null): ProductListColumnId[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return resolveVisibleColumnIds(parsed.filter(isKnownProductListColumnId));
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      "visibleColumnIds" in parsed &&
      Array.isArray((parsed as ProductListColumnPrefs).visibleColumnIds)
    ) {
      return resolveVisibleColumnIds(
        (parsed as ProductListColumnPrefs).visibleColumnIds.filter(isKnownProductListColumnId)
      );
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function serializeColumnPrefs(ids: ProductListColumnId[]): string {
  return JSON.stringify(columnPrefsFromIds(ids));
}

/** Migrace ze starého klíče iml-products-show-thumbnails. */
export const LEGACY_THUMBNAILS_STORAGE_KEY = "iml-products-show-thumbnails";

export function applyLegacyThumbnailPref(ids: ProductListColumnId[]): ProductListColumnId[] {
  if (ids.includes("thumbnail")) return ids;
  try {
    if (typeof localStorage === "undefined") return ids;
    if (localStorage.getItem(LEGACY_THUMBNAILS_STORAGE_KEY) === "1") {
      const thumbIdx = PRODUCT_LIST_COLUMNS.findIndex((c) => c.id === "thumbnail");
      const igIdx = ids.indexOf("ig_code");
      if (thumbIdx >= 0 && igIdx >= 0) {
        const next = [...ids];
        next.splice(igIdx, 0, "thumbnail");
        return resolveVisibleColumnIds(next);
      }
      return resolveVisibleColumnIds([...ids, "thumbnail"]);
    }
  } catch {
    /* ignore */
  }
  return ids;
}
