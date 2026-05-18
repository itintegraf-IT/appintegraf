import { enrichProductMaterialFields } from "@/lib/iml/product-materials";
import { findMaterialForImlLegacyId } from "@/lib/materialy/iml-compat";

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

export async function parseImlProductBody(body: Record<string, unknown>) {
  const str = (v: unknown) => (v != null && v !== "" ? String(v).trim() : null);
  const int = (v: unknown) => {
    if (v == null || v === "") return null;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  };

  const materialFields = await enrichProductMaterialFields(await resolveLegacyMaterialIds(body));

  return {
    customer_id: body.customer_id != null ? int(body.customer_id) : null,
    ig_code: str(body.ig_code),
    ig_short_name: str(body.ig_short_name),
    client_code: str(body.client_code),
    client_name: str(body.client_name),
    requester: str(body.requester),
    label_shape_code: str(body.label_shape_code),
    product_format: str(body.product_format),
    die_cut_tool_code: str(body.die_cut_tool_code),
    assembly_code: str(body.assembly_code),
    positions_on_sheet: int(body.positions_on_sheet),
    pieces_per_box: int(body.pieces_per_box),
    pieces_per_pallet: int(body.pieces_per_pallet),
    ...materialFields,
    print_note: str(body.print_note),
    has_print_sample: !!body.has_print_sample,
    ean_code: str(body.ean_code),
    production_notes: str(body.production_notes),
    approval_status: str(body.approval_status),
    realization_log: str(body.realization_log),
    internal_note: str(body.internal_note),
    item_status: str(body.item_status),
    print_data_version: str(body.print_data_version),
    stock_quantity: int(body.stock_quantity),
    sku: str(body.sku),
    is_active: body.is_active !== false,
    custom_data: parseCustomData(body.custom_data),
  };
}
