import { enrichProductMaterialFields } from "@/lib/iml/product-materials";
import {
  parseProductFormatToMm,
  syncProductFormatFromMm,
} from "@/lib/iml/product-format";
import { IML_LABEL_TYPES } from "@/lib/iml-constants";
import { findMaterialForImlLegacyId } from "@/lib/materialy/iml-compat";
import { cmykFlagsToDb, type ProductCmykFlags } from "@/lib/iml-print-colors-summary";

const VALID_LABEL_TYPES = new Set(IML_LABEL_TYPES.map((t) => t.value));

function parseCustomData(val: unknown): Record<string, unknown> | null {
  if (val == null) return null;
  if (typeof val === "object" && !Array.isArray(val)) {
    const obj = val as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof k === "string" && /^[a-z0-9_]+$/.test(k)) {
        if (v === null || v === undefined || v === "") continue;
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") clean[k] = v;
        else if (v instanceof Date) clean[k] = v.toISOString().slice(0, 10);
      }
    }
    return Object.keys(clean).length > 0 ? clean : null;
  }
  return null;
}

async function resolveLegacyMaterialIds(body: Record<string, unknown>) {
  const int = (v: unknown) => {
    if (v == null || v === "") return null;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  };
  const enriched = { ...body };

  if (enriched.foil_material_id == null && enriched.foil_id != null) {
    const legacyId = int(enriched.foil_id);
    if (legacyId != null) {
      const m = await findMaterialForImlLegacyId("FOIL", "iml_foils", legacyId);
      if (m) enriched.foil_material_id = m.id;
    }
  }
  if (enriched.color_material_id == null && (enriched.pantone_color_id != null || enriched.color_id != null)) {
    const legacyId = int(enriched.pantone_color_id ?? enriched.color_id);
    if (legacyId != null) {
      const m = await findMaterialForImlLegacyId("COLOR", "iml_pantone_colors", legacyId);
      if (m) enriched.color_material_id = m.id;
    }
  }

  return enriched;
}

/** labels_per_sheet > 0 nebo NULL. */
export function parseLabelsPerSheet(val: unknown): number | null {
  if (val == null || val === "") return null;
  const n = parseInt(String(val), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseDecimalMm(val: unknown): number | null {
  if (val == null || val === "") return null;
  const n = parseFloat(String(val).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function parseApprovalDate(val: unknown): Date | null {
  if (val == null || val === "") return null;
  const s = String(val).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseColorCount(val: unknown): number | null {
  if (val == null || val === "") return null;
  const n = parseInt(String(val), 10);
  if (!Number.isFinite(n) || n < 1 || n > 8) return null;
  return n;
}

function parseBoolDefaultTrue(val: unknown): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === "boolean") return val;
  const s = String(val).trim().toLowerCase();
  if (s === "false" || s === "0") return false;
  if (s === "true" || s === "1") return true;
  return true;
}

export function parseCmykFlagsFromBody(body: Record<string, unknown>): ProductCmykFlags {
  return {
    c: parseBoolDefaultTrue(body.cmyk_c_enabled),
    m: parseBoolDefaultTrue(body.cmyk_m_enabled),
    y: parseBoolDefaultTrue(body.cmyk_y_enabled),
    k: parseBoolDefaultTrue(body.cmyk_k_enabled),
  };
}

function parseLabelType(val: unknown): string | null {
  if (val == null || val === "") return null;
  const s = String(val).trim();
  return VALID_LABEL_TYPES.has(s as (typeof IML_LABEL_TYPES)[number]["value"]) ? s : null;
}

export async function parseImlProductBody(body: Record<string, unknown>) {
  const str = (v: unknown) => (v != null && v !== "" ? String(v).trim() : null);
  const int = (v: unknown) => {
    if (v == null || v === "") return null;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  };

  const resolved = await resolveLegacyMaterialIds(body);
  const materialFields = await enrichProductMaterialFields(resolved);

  let formatWidthMm = parseDecimalMm(body.format_width_mm);
  let formatHeightMm = parseDecimalMm(body.format_height_mm);
  const manualFormat = str(body.product_format);

  if (formatWidthMm == null && formatHeightMm == null && manualFormat) {
    const parsed = parseProductFormatToMm(manualFormat);
    if (parsed) {
      formatWidthMm = parsed.width;
      formatHeightMm = parsed.height;
    }
  }

  const productFormat = syncProductFormatFromMm(formatWidthMm, formatHeightMm, manualFormat);

  return {
    customer_id: body.customer_id != null ? int(body.customer_id) : null,
    ig_code: str(body.ig_code),
    ig_short_name: str(body.ig_short_name),
    client_code: str(body.client_code),
    client_name: str(body.client_name),
    requester: str(body.requester),
    label_shape_code: str(body.label_shape_code),
    product_format: productFormat,
    format_width_mm: formatWidthMm,
    format_height_mm: formatHeightMm,
    die_cut_tool_code: str(body.die_cut_tool_code),
    assembly_code: str(body.assembly_code),
    positions_on_sheet: int(body.positions_on_sheet),
    pieces_per_box: int(body.pieces_per_box),
    pieces_per_pallet: int(body.pieces_per_pallet),
    ...materialFields,
    labels_per_sheet: parseLabelsPerSheet(body.labels_per_sheet),
    print_note: str(body.print_note),
    has_print_sample: !!body.has_print_sample,
    has_print_proof: !!body.has_print_proof,
    ean_code: str(body.ean_code),
    production_notes: str(body.production_notes),
    approval_status: str(body.approval_status),
    approval_date: parseApprovalDate(body.approval_date),
    color_count: parseColorCount(body.color_count),
    print_colors_text: str(body.print_colors_text),
    ...cmykFlagsToDb(parseCmykFlagsFromBody(body)),
    label_type: parseLabelType(body.label_type),
    realization_log: str(body.realization_log),
    internal_note: str(body.internal_note),
    item_status: str(body.item_status),
    print_data_version: str(body.print_data_version),
    stock_quantity: int(body.stock_quantity),
    sku: str(body.sku),
    is_active: body.is_active !== false,
    custom_data: parseCustomData(body.custom_data),
    foil_id: body.foil_id != null ? int(body.foil_id) : null,
  };
}

/** Výsledek parseImlProductBody s vynulovaným foil_id při aktivním foil_material_id. */
export async function parseImlProductBodyForSave(body: Record<string, unknown>) {
  const data = await parseImlProductBody(body);
  const merged = { ...data };
  if (merged.foil_material_id != null) merged.foil_id = null;
  return merged;
}
