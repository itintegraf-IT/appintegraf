import {
  isImlToolTechnology,
  mapLegacyMachineToTechnology,
  type ImlToolTechnology,
} from "@/lib/iml/shape-tool-constants";

function normalizeHeaderKey(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

export const TOOL_IMPORT_FIELDS = [
  { key: "tool_code_new", label: "Nový kód (IMLxxxx)", required: true },
  { key: "tool_code_orig", label: "Původní kód (O-11, Mxx)", required: true },
  { key: "technology", label: "Technologie", required: true },
  { key: "primary_machine", label: "Primární stroj", required: false },
  { key: "weight_50g", label: "Hmotnost 50 g/m² (legacy)", required: false },
  { key: "weight_60g", label: "Hmotnost 60 g/m² (legacy)", required: false },
  { key: "status", label: "Stav", required: false },
  { key: "note", label: "Poznámka", required: false },
] as const;

export type ToolColumnMapping = Record<string, number>;

const AUTO_MAP: Record<string, string> = {
  "novy kod": "tool_code_new",
  "kod novy": "tool_code_new",
  iml: "tool_code_new",
  "tool code new": "tool_code_new",
  "tool_code_new": "tool_code_new",
  "puvodni kod": "tool_code_orig",
  "kod puvodni": "tool_code_orig",
  "tool code orig": "tool_code_orig",
  "tool_code_orig": "tool_code_orig",
  nastroj: "tool_code_orig",
  technologie: "technology",
  technology: "technology",
  stroj: "technology",
  "primarni stroj": "primary_machine",
  primary_machine: "primary_machine",
  "vysekovy stroj": "primary_machine",
  "hmotnost 50": "weight_50g",
  weight_50g: "weight_50g",
  "50g": "weight_50g",
  "hmotnost 60": "weight_60g",
  weight_60g: "weight_60g",
  "60g": "weight_60g",
  stav: "status",
  status: "status",
  poznamka: "note",
  note: "note",
};

export function autoMapToolColumns(headers: string[]): ToolColumnMapping {
  const mapping: ToolColumnMapping = {};
  headers.forEach((h, idx) => {
    const key = AUTO_MAP[normalizeHeaderKey(h)];
    if (key && mapping[key] == null) mapping[key] = idx;
  });
  return mapping;
}

function cell(row: unknown[], idx: number | undefined): string {
  if (idx == null || idx < 0 || idx >= row.length) return "";
  const v = row[idx];
  if (v == null) return "";
  return String(v).trim();
}

function parseDec(s: string): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export type ParsedToolImportRow = {
  tool_code_new: string;
  tool_code_orig: string;
  technology: ImlToolTechnology;
  primary_machine: string | null;
  weight_50g: number | null;
  weight_60g: number | null;
  status: string;
  note: string | null;
};

export function parseToolImportRow(
  row: unknown[],
  mapping: ToolColumnMapping
): ParsedToolImportRow | { error: string } {
  const tool_code_new = cell(row, mapping.tool_code_new).slice(0, 30);
  const tool_code_orig = cell(row, mapping.tool_code_orig).slice(0, 30);
  if (!tool_code_new) return { error: "Chybí nový kód nástroje" };
  if (!tool_code_orig) return { error: "Chybí původní kód nástroje" };

  const techRaw = cell(row, mapping.technology);
  let technology: ImlToolTechnology | null = isImlToolTechnology(techRaw)
    ? techRaw
    : mapLegacyMachineToTechnology(techRaw);
  if (!technology && techRaw) {
    const upper = techRaw.toUpperCase().replace(/\s+/g, "_");
    if (isImlToolTechnology(upper)) technology = upper;
  }
  if (!technology) {
    return { error: `Neplatná technologie: ${techRaw || "(prázdné)"}` };
  }

  const statusRaw = cell(row, mapping.status).toUpperCase() || "ACTIVE";
  const status = ["ACTIVE", "MAINTENANCE", "DECOMMISSIONED"].includes(statusRaw)
    ? statusRaw
    : "ACTIVE";

  return {
    tool_code_new,
    tool_code_orig,
    technology,
    primary_machine: cell(row, mapping.primary_machine).slice(0, 50) || null,
    weight_50g: parseDec(cell(row, mapping.weight_50g)),
    weight_60g: parseDec(cell(row, mapping.weight_60g)),
    status,
    note: cell(row, mapping.note).slice(0, 5000) || null,
  };
}
