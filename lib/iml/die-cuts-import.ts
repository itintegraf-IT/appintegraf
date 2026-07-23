/** Normalizace hlavičky pro auto-map (malá písmena, bez diakritiky). Bez serverových importů – používá i client page. */
function normalizeHeaderKey(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

export const DIE_CUT_IMPORT_FIELDS = [
  { key: "label_shape_code", label: "Kód tvaru etikety", required: true },
  { key: "die_cut_tool_code", label: "Nástroj (výsek)", required: false },
  { key: "assembly_code", label: "Montáž", required: false },
  { key: "positions_on_sheet", label: "Počet pozic na archu", required: false },
  { key: "labels_per_sheet", label: "Etiket na archu", required: false },
  { key: "pieces_per_box", label: "Kusů v krabici", required: false },
  { key: "pieces_per_pallet", label: "Kusů na paletě", required: false },
  { key: "note", label: "Poznámka", required: false },
] as const;

export type DieCutColumnMapping = Record<string, number>;

const AUTO_MAP: Record<string, string> = {
  "kod tvaru": "label_shape_code",
  "kod tvaru etikety": "label_shape_code",
  "label shape code": "label_shape_code",
  "label shape": "label_shape_code",
  type: "label_shape_code",
  produkt: "label_shape_code",
  tvar: "label_shape_code",
  "tvar etikety": "label_shape_code",
  nastroj: "die_cut_tool_code",
  "nastroj cislo": "die_cut_tool_code",
  "nastroj c.": "die_cut_tool_code",
  vysek: "die_cut_tool_code",
  vyrez: "die_cut_tool_code",
  "cislo nastroje": "die_cut_tool_code",
  montaz: "assembly_code",
  montáž: "assembly_code",
  assembly: "assembly_code",
  sestava: "assembly_code",
  "kod montaze": "assembly_code",
  pozice: "positions_on_sheet",
  "pozice na archu": "positions_on_sheet",
  "pocet pozic": "positions_on_sheet",
  "pocet pozic na archu": "positions_on_sheet",
  positions: "positions_on_sheet",
  "etiket na archu": "labels_per_sheet",
  "pocet etiket na archu": "labels_per_sheet",
  "labels per sheet": "labels_per_sheet",
  "ks v krabici": "pieces_per_box",
  "kusy v krabici": "pieces_per_box",
  "pieces per box": "pieces_per_box",
  krabice: "pieces_per_box",
  "ks na palete": "pieces_per_pallet",
  "kusy na palete": "pieces_per_pallet",
  paleta: "pieces_per_pallet",
  "pieces per pallet": "pieces_per_pallet",
  poznamka: "note",
  note: "note",
  popis: "note",
};

export function autoMapDieCutHeaders(headers: string[]): DieCutColumnMapping {
  const mapping: DieCutColumnMapping = {};
  headers.forEach((h, i) => {
    const key = normalizeHeaderKey(h);
    const target = AUTO_MAP[key];
    if (target && mapping[target] === undefined) {
      mapping[target] = i;
    }
  });
  return mapping;
}

export function validateDieCutImportMapping(mapping: DieCutColumnMapping | null): string | null {
  if (!mapping) return "Chybí mapování sloupců";
  if (typeof mapping.label_shape_code !== "number") {
    return "Mapování musí obsahovat pole label_shape_code (Kód tvaru etikety)";
  }
  return null;
}

export function rowToDieCutBody(
  row: string[],
  mapping: DieCutColumnMapping
): Record<string, unknown> {
  const get = (field: string) => {
    const idx = mapping[field];
    return idx != null && row[idx] != null ? String(row[idx]).trim() : "";
  };
  return {
    label_shape_code: get("label_shape_code"),
    die_cut_tool_code: get("die_cut_tool_code") || null,
    assembly_code: get("assembly_code") || null,
    positions_on_sheet: get("positions_on_sheet") || null,
    labels_per_sheet: get("labels_per_sheet") || null,
    pieces_per_box: get("pieces_per_box") || null,
    pieces_per_pallet: get("pieces_per_pallet") || null,
    note: get("note") || null,
    is_active: true,
  };
}
