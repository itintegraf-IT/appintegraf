import { SHAPE_PACKAGING_MATERIALS } from "@/lib/iml/die-cut-constants";
import {
  isImlImpositionLayoutType,
  isImlShapeToolPriority,
  isImlToolStatus,
  isImlToolTechnology,
  type ImlImpositionLayoutType,
  type ImlShapeToolPriority,
  type ImlToolStatus,
  type ImlToolTechnology,
} from "@/lib/iml/shape-tool-constants";

function parseOptionalInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalStr(value: unknown, max: number): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function parseRequiredStr(value: unknown, max: number): string | null {
  return parseOptionalStr(value, max);
}

function parseDecimal(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export type ParsedShapeBody = {
  shape_code: string;
  /** Kód z číselníku `iml_shape_types` (ne jen pevný ENUM). */
  shape_type: string;
  width_mm: number;
  height_mm: number;
  internal_note: string | null;
  drawing_file_path: string | null;
};

export function parseShapeBody(
  body: Record<string, unknown>
): ParsedShapeBody | { error: string } {
  const shape_code = parseRequiredStr(body.shape_code, 30);
  if (!shape_code) return { error: "Kód tvaru je povinný." };
  const shape_type_raw = parseRequiredStr(body.shape_type, 20);
  if (!shape_type_raw) {
    return { error: "Typ tvaru je povinný." };
  }
  const shape_type = shape_type_raw.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20);
  if (!shape_type) return { error: "Neplatný kód typu tvaru." };
  const width_mm = parseDecimal(body.width_mm);
  const height_mm = parseDecimal(body.height_mm);
  if (width_mm == null || width_mm <= 0) return { error: "Šířka (mm) je povinná." };
  if (height_mm == null || height_mm <= 0) return { error: "Výška (mm) je povinná." };
  return {
    shape_code,
    shape_type,
    width_mm,
    height_mm,
    internal_note: parseOptionalStr(body.internal_note, 255),
    drawing_file_path: parseOptionalStr(body.drawing_file_path, 255),
  };
}

export type ParsedToolBody = {
  tool_code_new: string;
  tool_code_orig: string;
  technology: ImlToolTechnology;
  primary_machine: string | null;
  /** @deprecated – hmotnosti patří do shape_material_packaging */
  weight_50g: number | null;
  weight_60g: number | null;
  status: ImlToolStatus;
  note: string | null;
};

export function parseToolBody(
  body: Record<string, unknown>
): ParsedToolBody | { error: string } {
  const tool_code_new = parseRequiredStr(body.tool_code_new, 30);
  if (!tool_code_new) return { error: "Nový kód nástroje (IMLxxxx) je povinný." };
  const tool_code_orig = parseRequiredStr(body.tool_code_orig, 30);
  if (!tool_code_orig) return { error: "Původní kód nástroje je povinný." };
  const technology_raw = parseRequiredStr(body.technology, 30);
  if (!technology_raw || !isImlToolTechnology(technology_raw)) {
    return { error: "Neplatná technologie nástroje." };
  }
  const status_raw = parseOptionalStr(body.status, 20) ?? "ACTIVE";
  if (!isImlToolStatus(status_raw)) return { error: "Neplatný stav nástroje." };
  return {
    tool_code_new,
    tool_code_orig,
    technology: technology_raw,
    primary_machine: parseOptionalStr(body.primary_machine, 50),
    weight_50g: parseDecimal(body.weight_50g),
    weight_60g: parseDecimal(body.weight_60g),
    status: status_raw,
    note: parseOptionalStr(body.note, 5000),
  };
}

export type ParsedPackagingBody = {
  material_code: string;
  weight_per_thousand: number;
  pcs_per_box: number;
  pcs_per_pallet: number;
  box_type: string | null;
};

export function parsePackagingBody(
  body: Record<string, unknown>
): ParsedPackagingBody | { error: string } {
  const material_raw = parseRequiredStr(body.material_code, 30);
  if (!material_raw) return { error: "Vyberte materiál ze seznamu." };
  const codeNorm = material_raw.toUpperCase().replace(/[\s_-]+/g, "");
  const catalog = SHAPE_PACKAGING_MATERIALS.find(
    (m) => m.code.toUpperCase() === codeNorm
  );
  if (!catalog) {
    return {
      error: `Materiál musí být z číselníku (${SHAPE_PACKAGING_MATERIALS.map((m) => m.label).join(", ")}).`,
    };
  }
  const weight_per_thousand = parseDecimal(body.weight_per_thousand);
  if (weight_per_thousand == null) {
    return { error: "Hmotnost (g/1000 ks) je povinná." };
  }
  if (weight_per_thousand < 0) return { error: "Hmotnost nemůže být záporná." };
  const pcs_per_box = parseOptionalInt(body.pcs_per_box) ?? 0;
  const pcs_per_pallet = parseOptionalInt(body.pcs_per_pallet) ?? 0;
  if (pcs_per_box < 0 || pcs_per_pallet < 0) {
    return { error: "Počty kusů nemohou být záporné." };
  }
  return {
    material_code: catalog.code,
    weight_per_thousand,
    pcs_per_box,
    pcs_per_pallet,
    box_type: parseOptionalStr(body.box_type, 50),
  };
}

export type ParsedAssignmentBody = {
  shape_id: number;
  tool_id: number;
  priority: ImlShapeToolPriority;
};

export function parseAssignmentBody(
  body: Record<string, unknown>
): ParsedAssignmentBody | { error: string } {
  const shape_id = parseOptionalInt(body.shape_id);
  const tool_id = parseOptionalInt(body.tool_id);
  if (shape_id == null) return { error: "Chybí tvar." };
  if (tool_id == null) return { error: "Chybí nástroj." };
  const priority_raw = parseOptionalStr(body.priority, 10) ?? "PRIMARY";
  if (!isImlShapeToolPriority(priority_raw)) {
    return { error: "Neplatná priorita (PRIMARY / ALT_1–3)." };
  }
  return { shape_id, tool_id, priority: priority_raw };
}

export type ParsedImpositionBody = {
  tool_id: number;
  imposition_code: string;
  positions_count: number;
  layout_type: ImlImpositionLayoutType;
  description: string | null;
};

export function parseImpositionBody(
  body: Record<string, unknown>
): ParsedImpositionBody | { error: string } {
  const tool_id = parseOptionalInt(body.tool_id);
  if (tool_id == null) return { error: "Chybí nástroj." };
  const imposition_code = parseRequiredStr(body.imposition_code, 30);
  if (!imposition_code) return { error: "Kód montáže je povinný." };
  const positions_count = parseOptionalInt(body.positions_count);
  if (positions_count == null || positions_count < 1) {
    return { error: "Počet užitků musí být kladné číslo." };
  }
  const layout_raw = parseOptionalStr(body.layout_type, 10) ?? "SOLO";
  if (!isImlImpositionLayoutType(layout_raw)) {
    return { error: "Neplatný typ montáže (SOLO / SET)." };
  }
  return {
    tool_id,
    imposition_code,
    positions_count,
    layout_type: layout_raw,
    description: parseOptionalStr(body.description, 255),
  };
}
