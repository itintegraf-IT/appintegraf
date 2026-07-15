/**
 * Metadata sloupců seznamu IML produktů (bez JSX – render v ProductListColumnCells).
 */

export const PRODUCT_LIST_COLUMNS_STORAGE_KEY = "iml-products-visible-columns";
/** Klíč pro budoucí sync do DB (fáze 2). */
export const PRODUCT_LIST_COLUMNS_PREF_KEY = "iml_products_columns";
export const PRODUCT_LIST_COLUMNS_PREF_VERSION = 1 as const;

export type ProductListColumnId =
  | "ig_code"
  | "name"
  | "customer"
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
  item_status: string | null;
  updated_at: string | Date | null;
  iml_customers?: { id: number; name: string } | null;
  iml_foils?: { id: number; code: string | null; name: string | null } | null;
  has_image?: boolean;
  has_pdf?: boolean;
};

export type ProductListColumnMeta = {
  id: ProductListColumnId;
  label: string;
  group: ProductListColumnGroup;
  defaultVisible: boolean;
  locked?: boolean;
  headerClassName?: string;
  cellClassName?: string;
  align?: "left" | "center" | "right";
};

/** Preference sloupců – formát pro localStorage i budoucí API. */
export type ProductListColumnPrefs = {
  version: typeof PRODUCT_LIST_COLUMNS_PREF_VERSION;
  visibleColumnIds: ProductListColumnId[];
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
  { id: "ig_code", label: "Kód IG", group: "základ", defaultVisible: true, locked: true },
  { id: "name", label: "Název / Klient", group: "základ", defaultVisible: true, locked: true },
  { id: "customer", label: "Zákazník", group: "základ", defaultVisible: true },
  { id: "status", label: "Stav", group: "základ", defaultVisible: true },
  { id: "pdf", label: "PDF", group: "základ", defaultVisible: true, align: "center", headerClassName: "w-20", cellClassName: "text-center" },
  { id: "actions", label: "Akce", group: "základ", defaultVisible: true, locked: true, align: "right" },
  { id: "thumbnail", label: "Náhled", group: "ostatní", defaultVisible: false, headerClassName: "w-14", cellClassName: "px-3 py-2" },
  { id: "sku", label: "SKU", group: "identifikace", defaultVisible: false },
  { id: "client_code", label: "Kód u klienta", group: "identifikace", defaultVisible: false },
  { id: "ig_short_name", label: "Zkrácený název IG", group: "identifikace", defaultVisible: false },
  { id: "requester", label: "Zadavatel", group: "identifikace", defaultVisible: false },
  { id: "ean_code", label: "EAN", group: "identifikace", defaultVisible: false, cellClassName: "font-mono text-sm" },
  { id: "die_cut_tool_code", label: "Výsekový nástroj", group: "výseky", defaultVisible: false, cellClassName: "max-w-[10rem] truncate" },
  { id: "label_shape_code", label: "Kód tvaru etikety", group: "výseky", defaultVisible: false },
  { id: "assembly_code", label: "Montážní kód", group: "výseky", defaultVisible: false },
  { id: "positions_on_sheet", label: "Pozic na archu", group: "výseky", defaultVisible: false, align: "right" },
  { id: "labels_per_sheet", label: "Etiket na arch", group: "výseky", defaultVisible: false, align: "right" },
  { id: "format", label: "Formát", group: "výseky", defaultVisible: false },
  { id: "print_colors_text", label: "Barvy (text)", group: "barvy", defaultVisible: false, cellClassName: "max-w-[12rem] truncate text-sm" },
  { id: "color_count", label: "Počet barev", group: "barvy", defaultVisible: false, align: "right" },
  { id: "color_coverage", label: "Pokrytí barev", group: "barvy", defaultVisible: false },
  { id: "foil", label: "Fólie", group: "barvy", defaultVisible: false },
  { id: "stock_quantity", label: "Sklad", group: "ostatní", defaultVisible: false, align: "right" },
  { id: "approval_status", label: "Schválení", group: "ostatní", defaultVisible: false },
  { id: "approval_date", label: "Datum schválení", group: "ostatní", defaultVisible: false },
  { id: "updated_at", label: "Upraveno", group: "ostatní", defaultVisible: false, cellClassName: "text-sm text-gray-600 whitespace-nowrap" },
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
