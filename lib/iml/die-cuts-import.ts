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
  { key: "die_cut_tool_code", label: "Označení výsekového nástroje", required: false },
  { key: "assembly_code", label: "Kód montáže", required: false },
  { key: "internal_name", label: "Název interní", required: false },
  { key: "die_cut_format", label: "Formát výseku", required: false },
  { key: "positions_on_sheet", label: "Počet pozic na archu", required: false },
  { key: "customer_name", label: "Zákazník (jméno)", required: false },
  { key: "primary_machine", label: "Výsekový stroj (primární)", required: false },
  { key: "pieces_per_box", label: "Kusů v krabici", required: false },
  { key: "box_type", label: "Typ krabice (kód/název)", required: false },
  { key: "pieces_per_pallet", label: "Kusů na paletě", required: false },
  { key: "mat_eup_60_weight", label: "Hmotnost EUP 60 (zaškrtne materiál)", required: false },
  { key: "mat_eup_50_weight", label: "Hmotnost EUP 50 (zaškrtne materiál)", required: false },
  { key: "mat_eth_55_weight", label: "Hmotnost ETH 55 (zaškrtne materiál)", required: false },
  { key: "mat_elr_70_weight", label: "Hmotnost ELR 70 (zaškrtne materiál)", required: false },
  { key: "note", label: "Poznámka", required: false },
  { key: "note_prepress", label: "Poznámka (Prepress)", required: false },
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
  "oznaceni vysekoveho nastroje": "die_cut_tool_code",
  vysek: "die_cut_tool_code",
  "cislo nastroje": "die_cut_tool_code",
  montaz: "assembly_code",
  "kod montaze": "assembly_code",
  assembly: "assembly_code",
  "nazev interni": "internal_name",
  interni: "internal_name",
  "format vyseku": "die_cut_format",
  format: "die_cut_format",
  pozice: "positions_on_sheet",
  "pozice na archu": "positions_on_sheet",
  "pocet pozic": "positions_on_sheet",
  "pocet pozic na archu": "positions_on_sheet",
  "pocet uzitku": "positions_on_sheet",
  zakaznik: "customer_name",
  customer: "customer_name",
  stroj: "primary_machine",
  "vysekovy stroj": "primary_machine",
  "ks v krabici": "pieces_per_box",
  "kusy v krabici": "pieces_per_box",
  "typ krabice": "box_type",
  krabice: "box_type",
  "ks na palete": "pieces_per_pallet",
  "kusy na palete": "pieces_per_pallet",
  "eup 60": "mat_eup_60_weight",
  "hmotnost eup 60": "mat_eup_60_weight",
  "eup 50": "mat_eup_50_weight",
  "hmotnost eup 50": "mat_eup_50_weight",
  "eth 55": "mat_eth_55_weight",
  "hmotnost eth 55": "mat_eth_55_weight",
  "elr 70": "mat_elr_70_weight",
  "hmotnost elr 70": "mat_elr_70_weight",
  poznamka: "note",
  note: "note",
  "poznamka prepress": "note_prepress",
  prepress: "note_prepress",
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

function truthyMaterialWeight(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  if (v === "0" || v === "ne" || v === "no" || v === "false" || v === "-") return false;
  return true;
}

export function rowToDieCutBody(
  row: string[],
  mapping: DieCutColumnMapping
): Record<string, unknown> {
  const get = (field: string) => {
    const idx = mapping[field];
    return idx != null && row[idx] != null ? String(row[idx]).trim() : "";
  };

  const eup60 = get("mat_eup_60_weight");
  const eup50 = get("mat_eup_50_weight");
  const eth55 = get("mat_eth_55_weight");
  const elr70 = get("mat_elr_70_weight");

  return {
    label_shape_code: get("label_shape_code"),
    die_cut_tool_code: get("die_cut_tool_code") || null,
    assembly_code: get("assembly_code") || null,
    internal_name: get("internal_name") || null,
    die_cut_format: get("die_cut_format") || null,
    positions_on_sheet: get("positions_on_sheet") || null,
    customer_name: get("customer_name") || null,
    primary_machine: get("primary_machine") || null,
    pieces_per_box: get("pieces_per_box") || null,
    box_type: get("box_type") || null,
    pieces_per_pallet: get("pieces_per_pallet") || null,
    mat_eup_60: truthyMaterialWeight(eup60),
    mat_eup_60_weight: truthyMaterialWeight(eup60) ? eup60 : null,
    mat_eup_50: truthyMaterialWeight(eup50),
    mat_eup_50_weight: truthyMaterialWeight(eup50) ? eup50 : null,
    mat_eth_55: truthyMaterialWeight(eth55),
    mat_eth_55_weight: truthyMaterialWeight(eth55) ? eth55 : null,
    mat_elr_70: truthyMaterialWeight(elr70),
    mat_elr_70_weight: truthyMaterialWeight(elr70) ? elr70 : null,
    note: get("note") || null,
    note_prepress: get("note_prepress") || null,
    is_active: true,
  };
}
