/** Sdílený katalog exportovatelných polí produktu (produkty + objednávky). */

export type ProductExportFieldGroup =
  | "identification"
  | "die_cut"
  | "materials"
  | "print"
  | "colors"
  | "system";

export const PRODUCT_EXPORT_FIELD_GROUPS: Array<{ id: ProductExportFieldGroup; label: string }> =
  [
    { id: "identification", label: "Identifikace" },
    { id: "die_cut", label: "Výseky" },
    { id: "materials", label: "Materiály" },
    { id: "print", label: "Tisková data" },
    { id: "colors", label: "Barvy" },
    { id: "system", label: "Systém" },
  ];

export const PRODUCT_EXPORT_FIELD_KEYS = [
  "id",
  "ig_code",
  "ig_short_name",
  "client_code",
  "client_name",
  "sku",
  "product_kind",
  "customer_name",
  "customer_id",
  "requester",
  "label_shape_code",
  "product_format",
  "format_width_mm",
  "format_height_mm",
  "die_cut_tool_code",
  "die_cut_id",
  "assembly_code",
  "positions_on_sheet",
  "labels_per_sheet",
  "pieces_per_box",
  "pieces_per_pallet",
  "foil_type",
  "foil_id",
  "foil_material_id",
  "foil_material_name",
  "paper_material_id",
  "paper_material_name",
  "color_material_id",
  "color_material_name",
  "lacquer_material_id",
  "lacquer_material_name",
  "color_coverage",
  "print_note",
  "production_notes",
  "ean_code",
  "item_status",
  "approval_status",
  "approval_date",
  "print_data_version",
  "stock_quantity",
  "last_edited_by",
  "realization_log",
  "internal_note",
  "color_count",
  "print_colors_text",
  "pantone_codes",
  "pantone_coverage",
  "label_type",
  "cmyk_c_enabled",
  "cmyk_m_enabled",
  "cmyk_y_enabled",
  "cmyk_k_enabled",
  "has_print_sample",
  "has_print_proof",
  "is_active",
  "archived_at",
  "pdf_archive_path",
  "custom_data",
  "created_at",
  "updated_at",
] as const;

export type ProductExportFieldKey = (typeof PRODUCT_EXPORT_FIELD_KEYS)[number];

export type ProductExportFieldDef = {
  key: ProductExportFieldKey;
  label: string;
  group: ProductExportFieldGroup;
  defaultSelected?: boolean;
  /** Klíč ve exportu objednávek (kvůli kolizím nebo aliasům). */
  orderKey?: string;
};

export const PRODUCT_EXPORT_FIELD_DEFS: ProductExportFieldDef[] = [
  { key: "id", label: "ID", group: "identification", defaultSelected: true, orderKey: "product_id" },
  { key: "ig_code", label: "Kód IG", group: "identification", defaultSelected: true },
  { key: "ig_short_name", label: "Zkrácený název", group: "identification", defaultSelected: true },
  { key: "client_code", label: "Kód klienta", group: "identification", defaultSelected: true },
  { key: "client_name", label: "Název klienta", group: "identification", defaultSelected: true },
  { key: "sku", label: "SKU", group: "identification" },
  { key: "product_kind", label: "Druh produktu", group: "identification", defaultSelected: true },
  {
    key: "customer_name",
    label: "Zákazník",
    group: "identification",
    defaultSelected: true,
    orderKey: "product_customer_name",
  },
  { key: "customer_id", label: "ID zákazníka", group: "identification" },
  { key: "requester", label: "Žadatel", group: "identification" },

  { key: "label_shape_code", label: "Tvar etikety", group: "die_cut" },
  { key: "product_format", label: "Formát", group: "die_cut" },
  { key: "format_width_mm", label: "Šířka (mm)", group: "die_cut" },
  { key: "format_height_mm", label: "Výška (mm)", group: "die_cut" },
  { key: "die_cut_tool_code", label: "Výsek", group: "die_cut" },
  { key: "die_cut_id", label: "ID výseku", group: "die_cut" },
  { key: "assembly_code", label: "Sestava", group: "die_cut" },
  { key: "positions_on_sheet", label: "Pozic na archu", group: "die_cut" },
  { key: "labels_per_sheet", label: "Etiket na arch", group: "die_cut" },
  { key: "pieces_per_box", label: "Ks / krabice", group: "die_cut" },
  { key: "pieces_per_pallet", label: "Ks / paleta", group: "die_cut" },

  { key: "foil_type", label: "Fólie", group: "materials" },
  { key: "foil_id", label: "ID fólie (číselník)", group: "materials" },
  { key: "foil_material_id", label: "ID materiálu fólie", group: "materials" },
  { key: "foil_material_name", label: "Fólie (katalog)", group: "materials" },
  { key: "paper_material_id", label: "ID materiálu papír", group: "materials" },
  { key: "paper_material_name", label: "Papír (katalog)", group: "materials" },
  { key: "color_material_id", label: "ID materiálu barevnost", group: "materials" },
  { key: "color_material_name", label: "Barevnost (katalog)", group: "materials" },
  { key: "lacquer_material_id", label: "ID materiálu lak", group: "materials" },
  { key: "lacquer_material_name", label: "Lak (katalog)", group: "materials" },
  { key: "color_coverage", label: "Pokrytí barev", group: "materials" },
  { key: "print_note", label: "Poznámka k tisku", group: "materials" },
  { key: "production_notes", label: "Výrobní poznámky", group: "materials" },

  { key: "ean_code", label: "EAN", group: "print" },
  { key: "item_status", label: "Stav položky", group: "print", defaultSelected: true },
  { key: "approval_status", label: "Stav schválení", group: "print" },
  { key: "approval_date", label: "Datum schválení", group: "print" },
  { key: "print_data_version", label: "Verze tiskových dat", group: "print" },
  { key: "stock_quantity", label: "Skladem", group: "print" },
  { key: "last_edited_by", label: "Naposledy editoval", group: "print" },
  { key: "realization_log", label: "LOG realizací", group: "print" },
  { key: "internal_note", label: "Interní poznámka", group: "print" },
  { key: "label_type", label: "Typ etikety", group: "print" },
  { key: "has_print_sample", label: "Tiskový vzorek", group: "print" },
  { key: "has_print_proof", label: "Nátisk", group: "print" },

  { key: "color_count", label: "Počet barev", group: "colors" },
  { key: "print_colors_text", label: "Barvy (souhrn)", group: "colors" },
  { key: "pantone_codes", label: "Pantone kódy", group: "colors" },
  { key: "pantone_coverage", label: "Pantone + pokrytí %", group: "colors" },
  { key: "cmyk_c_enabled", label: "CMYK C", group: "colors" },
  { key: "cmyk_m_enabled", label: "CMYK M", group: "colors" },
  { key: "cmyk_y_enabled", label: "CMYK Y", group: "colors" },
  { key: "cmyk_k_enabled", label: "CMYK K", group: "colors" },

  { key: "is_active", label: "Aktivní", group: "system" },
  { key: "archived_at", label: "Archivováno", group: "system" },
  { key: "pdf_archive_path", label: "Cesta archivu PDF", group: "system" },
  { key: "custom_data", label: "Vlastní data (JSON)", group: "system" },
  { key: "created_at", label: "Vytvořeno", group: "system" },
  { key: "updated_at", label: "Upraveno", group: "system", defaultSelected: true },
];

export const DEFAULT_PRODUCT_EXPORT_FIELD_KEYS: ProductExportFieldKey[] =
  PRODUCT_EXPORT_FIELD_DEFS.filter((c) => c.defaultSelected).map((c) => c.key);

const FIELD_KEY_SET = new Set<string>(PRODUCT_EXPORT_FIELD_KEYS);

export function isProductExportFieldKey(key: string): key is ProductExportFieldKey {
  return FIELD_KEY_SET.has(key);
}

export function productFieldOrderKey(key: ProductExportFieldKey): string {
  return PRODUCT_EXPORT_FIELD_DEFS.find((d) => d.key === key)?.orderKey ?? key;
}

export function productFieldFromOrderKey(orderKey: string): ProductExportFieldKey | null {
  for (const def of PRODUCT_EXPORT_FIELD_DEFS) {
    const ok = def.orderKey ?? def.key;
    if (ok === orderKey) return def.key;
  }
  return isProductExportFieldKey(orderKey) ? orderKey : null;
}

export type ProductColorExportRow = {
  coverage_pct?: unknown;
  iml_pantone_colors?: { code: string | null } | null;
};

export type ProductExportSourceRow = {
  id: number;
  ig_code: string | null;
  ig_short_name: string | null;
  client_code: string | null;
  client_name: string | null;
  sku: string | null;
  product_kind: string | null;
  customer_id: number | null;
  requester: string | null;
  label_shape_code: string | null;
  product_format: string | null;
  format_width_mm: unknown;
  format_height_mm: unknown;
  die_cut_tool_code: string | null;
  die_cut_id: number | null;
  assembly_code: string | null;
  positions_on_sheet: number | null;
  labels_per_sheet: number | null;
  pieces_per_box: number | null;
  pieces_per_pallet: number | null;
  foil_type: string | null;
  foil_id: number | null;
  foil_material_id: number | null;
  paper_material_id: number | null;
  color_material_id: number | null;
  lacquer_material_id: number | null;
  color_coverage: string | null;
  print_note: string | null;
  production_notes: string | null;
  ean_code: string | null;
  item_status: string | null;
  approval_status: string | null;
  approval_date: Date | null;
  print_data_version: string | null;
  stock_quantity: number | null;
  last_edited_by: string | null;
  realization_log: string | null;
  internal_note: string | null;
  color_count: number | null;
  print_colors_text: string | null;
  label_type: string | null;
  cmyk_c_enabled: boolean;
  cmyk_m_enabled: boolean;
  cmyk_y_enabled: boolean;
  cmyk_k_enabled: boolean;
  has_print_sample: boolean;
  has_print_proof: boolean;
  is_active: boolean;
  archived_at: Date | null;
  pdf_archive_path: string | null;
  custom_data: unknown;
  created_at: Date;
  updated_at: Date;
  iml_customers?: { name: string } | null;
  foil_material?: { name: string } | null;
  paper_material?: { name: string } | null;
  color_material?: { name: string } | null;
  lacquer_material?: { name: string } | null;
  iml_product_colors?: ProductColorExportRow[];
  image_data?: Buffer | null;
};

function fmtDate(v: Date | string | null | undefined): string {
  if (v == null || v === "") return "";
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function fmtBool(v: boolean | null | undefined): string {
  if (v == null) return "";
  return v ? "ano" : "ne";
}

function fmtDecimal(v: unknown): string {
  if (v == null || v === "") return "";
  return String(v);
}

function fmtJson(v: unknown): string {
  if (v == null) return "";
  try {
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    return "";
  }
}

export function formatPantoneCodes(colors: ProductColorExportRow[] | undefined): string {
  return (colors ?? [])
    .map((c) => c.iml_pantone_colors?.code)
    .filter(Boolean)
    .join(", ");
}

export function formatPantoneCoverage(colors: ProductColorExportRow[] | undefined): string {
  return (colors ?? [])
    .map((c) => {
      const code = c.iml_pantone_colors?.code;
      if (!code) return null;
      const pct = c.coverage_pct != null ? String(c.coverage_pct) : "";
      return pct ? `${code}:${pct}%` : code;
    })
    .filter(Boolean)
    .join(", ");
}

export function serializeProductFieldValue(
  row: ProductExportSourceRow | null | undefined,
  key: ProductExportFieldKey
): string {
  if (!row) return "";
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
    case "customer_id":
      return row.customer_id != null ? String(row.customer_id) : "";
    case "requester":
      return row.requester ?? "";
    case "label_shape_code":
      return row.label_shape_code ?? "";
    case "product_format":
      return row.product_format ?? "";
    case "format_width_mm":
      return fmtDecimal(row.format_width_mm);
    case "format_height_mm":
      return fmtDecimal(row.format_height_mm);
    case "die_cut_tool_code":
      return row.die_cut_tool_code ?? "";
    case "die_cut_id":
      return row.die_cut_id != null ? String(row.die_cut_id) : "";
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
    case "foil_id":
      return row.foil_id != null ? String(row.foil_id) : "";
    case "foil_material_id":
      return row.foil_material_id != null ? String(row.foil_material_id) : "";
    case "foil_material_name":
      return row.foil_material?.name ?? "";
    case "paper_material_id":
      return row.paper_material_id != null ? String(row.paper_material_id) : "";
    case "paper_material_name":
      return row.paper_material?.name ?? "";
    case "color_material_id":
      return row.color_material_id != null ? String(row.color_material_id) : "";
    case "color_material_name":
      return row.color_material?.name ?? "";
    case "lacquer_material_id":
      return row.lacquer_material_id != null ? String(row.lacquer_material_id) : "";
    case "lacquer_material_name":
      return row.lacquer_material?.name ?? "";
    case "color_coverage":
      return row.color_coverage ?? "";
    case "print_note":
      return row.print_note ?? "";
    case "production_notes":
      return row.production_notes ?? "";
    case "ean_code":
      return row.ean_code ?? "";
    case "item_status":
      return row.item_status ?? "";
    case "approval_status":
      return row.approval_status ?? "";
    case "approval_date":
      return fmtDate(row.approval_date);
    case "print_data_version":
      return row.print_data_version ?? "";
    case "stock_quantity":
      return row.stock_quantity != null ? String(row.stock_quantity) : "";
    case "last_edited_by":
      return row.last_edited_by ?? "";
    case "realization_log":
      return row.realization_log ?? "";
    case "internal_note":
      return row.internal_note ?? "";
    case "color_count":
      return row.color_count != null ? String(row.color_count) : "";
    case "print_colors_text":
      return row.print_colors_text ?? "";
    case "pantone_codes":
      return formatPantoneCodes(row.iml_product_colors);
    case "pantone_coverage":
      return formatPantoneCoverage(row.iml_product_colors);
    case "label_type":
      return row.label_type ?? "";
    case "cmyk_c_enabled":
      return fmtBool(row.cmyk_c_enabled);
    case "cmyk_m_enabled":
      return fmtBool(row.cmyk_m_enabled);
    case "cmyk_y_enabled":
      return fmtBool(row.cmyk_y_enabled);
    case "cmyk_k_enabled":
      return fmtBool(row.cmyk_k_enabled);
    case "has_print_sample":
      return fmtBool(row.has_print_sample);
    case "has_print_proof":
      return fmtBool(row.has_print_proof);
    case "is_active":
      return fmtBool(row.is_active);
    case "archived_at":
      return fmtDate(row.archived_at);
    case "pdf_archive_path":
      return row.pdf_archive_path ?? "";
    case "custom_data":
      return fmtJson(row.custom_data);
    case "created_at":
      return fmtDate(row.created_at);
    case "updated_at":
      return fmtDate(row.updated_at);
    default:
      return "";
  }
}

const MATERIAL_FIELD_KEYS = new Set<ProductExportFieldKey>([
  "foil_material_id",
  "foil_material_name",
  "paper_material_id",
  "paper_material_name",
  "color_material_id",
  "color_material_name",
  "lacquer_material_id",
  "lacquer_material_name",
]);

export function productExportNeedsPantone(
  keys: Iterable<{ key: string } | string>
): boolean {
  for (const item of keys) {
    const key = typeof item === "string" ? item : item.key;
    if (key === "pantone_codes" || key === "pantone_coverage") return true;
    const pf = productFieldFromOrderKey(key);
    if (pf === "pantone_codes" || pf === "pantone_coverage") return true;
  }
  return false;
}

export function productExportNeedsMaterials(
  keys: Iterable<{ key: string } | string>
): boolean {
  for (const item of keys) {
    const key = typeof item === "string" ? item : item.key;
    const pf = productFieldFromOrderKey(key);
    if (pf && MATERIAL_FIELD_KEYS.has(pf)) return true;
  }
  return false;
}

const SCALAR_PRODUCT_SELECT = {
  id: true,
  ig_code: true,
  ig_short_name: true,
  client_code: true,
  client_name: true,
  sku: true,
  product_kind: true,
  customer_id: true,
  requester: true,
  label_shape_code: true,
  product_format: true,
  format_width_mm: true,
  format_height_mm: true,
  die_cut_tool_code: true,
  die_cut_id: true,
  assembly_code: true,
  positions_on_sheet: true,
  labels_per_sheet: true,
  pieces_per_box: true,
  pieces_per_pallet: true,
  foil_type: true,
  foil_id: true,
  foil_material_id: true,
  paper_material_id: true,
  color_material_id: true,
  lacquer_material_id: true,
  color_coverage: true,
  print_note: true,
  production_notes: true,
  ean_code: true,
  item_status: true,
  approval_status: true,
  approval_date: true,
  print_data_version: true,
  stock_quantity: true,
  last_edited_by: true,
  realization_log: true,
  internal_note: true,
  color_count: true,
  print_colors_text: true,
  label_type: true,
  cmyk_c_enabled: true,
  cmyk_m_enabled: true,
  cmyk_y_enabled: true,
  cmyk_k_enabled: true,
  has_print_sample: true,
  has_print_proof: true,
  is_active: true,
  archived_at: true,
  pdf_archive_path: true,
  custom_data: true,
  created_at: true,
  updated_at: true,
} as const;

export function buildProductExportPrismaInclude(
  keys: Iterable<{ key: string } | string>,
  opts?: { withAssets?: boolean; needPantone?: boolean; needMaterials?: boolean }
): Record<string, unknown> {
  const needPantone = opts?.needPantone ?? productExportNeedsPantone(keys);
  const needMaterials = opts?.needMaterials ?? productExportNeedsMaterials(keys);

  return {
    iml_customers: { select: { name: true } },
    ...(needMaterials
      ? {
          foil_material: { select: { name: true } },
          paper_material: { select: { name: true } },
          color_material: { select: { name: true } },
          lacquer_material: { select: { name: true } },
        }
      : {}),
    ...(needPantone
      ? {
          iml_product_colors: {
            orderBy: [{ sort_order: "asc" as const }, { id: "asc" as const }],
            select: {
              coverage_pct: true,
              iml_pantone_colors: { select: { code: true } },
            },
          },
        }
      : {}),
  };
}

export function buildProductExportPrismaSelect(
  keys: Iterable<{ key: string } | string>,
  opts?: { withAssets?: boolean }
): Record<string, unknown> {
  const include = buildProductExportPrismaInclude(keys, opts);
  return {
    ...SCALAR_PRODUCT_SELECT,
    ...(opts?.withAssets ? { image_data: true } : {}),
    ...include,
  };
}

export function emptyProductExportSourceRow(id = 0): ProductExportSourceRow {
  return {
    id,
    ig_code: null,
    ig_short_name: null,
    client_code: null,
    client_name: null,
    sku: null,
    product_kind: null,
    customer_id: null,
    requester: null,
    label_shape_code: null,
    product_format: null,
    format_width_mm: null,
    format_height_mm: null,
    die_cut_tool_code: null,
    die_cut_id: null,
    assembly_code: null,
    positions_on_sheet: null,
    labels_per_sheet: null,
    pieces_per_box: null,
    pieces_per_pallet: null,
    foil_type: null,
    foil_id: null,
    foil_material_id: null,
    paper_material_id: null,
    color_material_id: null,
    lacquer_material_id: null,
    color_coverage: null,
    print_note: null,
    production_notes: null,
    ean_code: null,
    item_status: null,
    approval_status: null,
    approval_date: null,
    print_data_version: null,
    stock_quantity: null,
    last_edited_by: null,
    realization_log: null,
    internal_note: null,
    color_count: null,
    print_colors_text: null,
    label_type: null,
    cmyk_c_enabled: true,
    cmyk_m_enabled: true,
    cmyk_y_enabled: true,
    cmyk_k_enabled: true,
    has_print_sample: false,
    has_print_proof: false,
    is_active: true,
    archived_at: null,
    pdf_archive_path: null,
    custom_data: null,
    created_at: new Date(0),
    updated_at: new Date(0),
  };
}

export function mapDbProductToExportRow(
  p: Record<string, unknown> | null | undefined
): ProductExportSourceRow | null {
  if (!p || p.id == null) return null;
  return {
    ...(emptyProductExportSourceRow(Number(p.id))),
    ...p,
    id: Number(p.id),
  } as ProductExportSourceRow;
}
