/** Pomocné typy a mapování pro globální katalog výseků IML. */

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

export function parseDieCutBody(body: Record<string, unknown>): {
  label_shape_code: string;
  die_cut_tool_code: string | null;
  assembly_code: string | null;
  positions_on_sheet: number | null;
  labels_per_sheet: number | null;
  pieces_per_box: number | null;
  pieces_per_pallet: number | null;
  note: string | null;
  is_active: boolean;
} | { error: string; field?: string } {
  const label_shape_code = parseOptionalStr(body.label_shape_code, 100);
  if (!label_shape_code) {
    return { error: "Kód tvaru etikety je povinný.", field: "label_shape_code" };
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
  };
}
