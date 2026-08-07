/** Pomocné typy a mapování pro globální katalog výseků IML. */

import { DIE_CUT_MATERIALS } from "@/lib/iml/die-cut-constants";

export type ImDieCutFields = {
  label_shape_code: string;
  die_cut_tool_code: string | null;
  assembly_code: string | null;
  positions_on_sheet: number | null;
  labels_per_sheet: number | null;
  pieces_per_box: number | null;
  pieces_per_pallet: number | null;
};

export type ImDieCutRow = ImDieCutFields & {
  id: number;
  note: string | null;
  is_active: boolean;
  created_at?: Date | string;
  updated_at?: Date | string;
};

export function parseOptionalInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

export function parseOptionalStr(value: unknown, max = 100): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function parseBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

/** Denormalizovaná pole produktu z katalogu výseku (pro list/report/export). */
export function dieCutToProductFields(dieCut: ImDieCutFields): {
  label_shape_code: string;
  die_cut_tool_code: string | null;
  assembly_code: string | null;
  positions_on_sheet: number | null;
  labels_per_sheet: number | null;
  pieces_per_box: number | null;
  pieces_per_pallet: number | null;
} {
  return {
    label_shape_code: dieCut.label_shape_code,
    die_cut_tool_code: dieCut.die_cut_tool_code,
    assembly_code: dieCut.assembly_code,
    positions_on_sheet: dieCut.positions_on_sheet,
    labels_per_sheet: dieCut.labels_per_sheet,
    pieces_per_box: dieCut.pieces_per_box,
    pieces_per_pallet: dieCut.pieces_per_pallet,
  };
}

export type ParsedDieCutBody = {
  label_shape_code: string;
  die_cut_tool_code: string | null;
  assembly_code: string | null;
  positions_on_sheet: number | null;
  labels_per_sheet: number | null;
  pieces_per_box: number | null;
  pieces_per_pallet: number | null;
  note: string | null;
  is_active: boolean;
  internal_name: string | null;
  die_cut_format: string | null;
  customer_id: number | null;
  primary_machine: string | null;
  box_type_id: number | null;
  note_prepress: string | null;
  mat_eup_60: boolean;
  mat_eup_60_weight: string | null;
  mat_eup_50: boolean;
  mat_eup_50_weight: string | null;
  mat_eth_55: boolean;
  mat_eth_55_weight: string | null;
  mat_elr_70: boolean;
  mat_elr_70_weight: string | null;
};

export function parseDieCutBody(
  body: Record<string, unknown>
): ParsedDieCutBody | { error: string; field?: string } {
  const label_shape_code = parseOptionalStr(body.label_shape_code, 100);
  if (!label_shape_code) {
    return { error: "Kód tvaru etikety je povinný.", field: "label_shape_code" };
  }

  const customer_id = parseOptionalInt(body.customer_id);
  const box_type_id = parseOptionalInt(body.box_type_id);

  const materials: Record<string, boolean | string | null> = {};
  for (const mat of DIE_CUT_MATERIALS) {
    const enabled = parseBool(body[mat.enabledField]);
    const weight = enabled ? parseOptionalStr(body[mat.weightField], 50) : null;
    if (enabled && !weight) {
      return {
        error: `U materiálu ${mat.label} je povinná hmotnost.`,
        field: mat.weightField,
      };
    }
    materials[mat.enabledField] = enabled;
    materials[mat.weightField] = weight;
  }

  return {
    label_shape_code,
    die_cut_tool_code: parseOptionalStr(body.die_cut_tool_code, 100),
    assembly_code: parseOptionalStr(body.assembly_code, 100),
    positions_on_sheet: parseOptionalInt(body.positions_on_sheet),
    labels_per_sheet: parseOptionalInt(body.labels_per_sheet),
    pieces_per_box: parseOptionalInt(body.pieces_per_box),
    pieces_per_pallet: parseOptionalInt(body.pieces_per_pallet),
    note: parseOptionalStr(body.note, 5000),
    is_active: body.is_active !== false && body.is_active !== "false" && body.is_active !== 0,
    internal_name: parseOptionalStr(body.internal_name, 255),
    die_cut_format: parseOptionalStr(body.die_cut_format, 100),
    customer_id,
    primary_machine: parseOptionalStr(body.primary_machine, 100),
    box_type_id,
    note_prepress: parseOptionalStr(body.note_prepress, 5000),
    mat_eup_60: materials.mat_eup_60 as boolean,
    mat_eup_60_weight: materials.mat_eup_60_weight as string | null,
    mat_eup_50: materials.mat_eup_50 as boolean,
    mat_eup_50_weight: materials.mat_eup_50_weight as string | null,
    mat_eth_55: materials.mat_eth_55 as boolean,
    mat_eth_55_weight: materials.mat_eth_55_weight as string | null,
    mat_elr_70: materials.mat_elr_70 as boolean,
    mat_elr_70_weight: materials.mat_elr_70_weight as string | null,
  };
}
