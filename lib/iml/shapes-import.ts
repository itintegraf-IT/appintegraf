import {
  isImlShapeType,
  isImlToolTechnology,
  mapLegacyMachineToTechnology,
  type ImlShapeType,
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

export const SHAPE_IMPORT_FIELDS = [
  { key: "shape_code", label: "Kód tvaru (IML-CUP-…)", required: true },
  { key: "tool_code", label: "Kód nástroje", required: true },
  { key: "format", label: "Formát (Š × V mm)", required: true },
  { key: "shape_type", label: "Typ (vanička / víčko)", required: false },
  { key: "technology", label: "Technologie / stroj", required: false },
  { key: "customers", label: "Zákazníci (čárkou)", required: false },
  { key: "note", label: "Poznámka", required: false },
] as const;

export type ShapeColumnMapping = Record<string, number>;

const AUTO_MAP: Record<string, string> = {
  kod: "shape_code",
  "kod tvaru": "shape_code",
  shape_code: "shape_code",
  shape: "shape_code",
  nastroj: "tool_code",
  "kod nastroje": "tool_code",
  tool: "tool_code",
  tool_code: "tool_code",
  "tool_code_orig": "tool_code",
  format: "format",
  rozmery: "format",
  "sirka x vyska": "format",
  typ: "shape_type",
  shape_type: "shape_type",
  druh: "shape_type",
  technologie: "technology",
  technology: "technology",
  stroj: "technology",
  "sloupec 9": "technology",
  zakaznici: "customers",
  customers: "customers",
  klient: "customers",
  klienti: "customers",
  "sloupec 10": "customers",
  poznamka: "note",
  note: "note",
};

export function autoMapShapeColumns(headers: string[]): ShapeColumnMapping {
  const mapping: ShapeColumnMapping = {};
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

/** Parse „94,86 x 112“, „69x102“, „100 × 100“. */
export function parseFormatMm(
  raw: string
): { width_mm: number; height_mm: number } | null {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return null;
  const m = s.match(
    /^(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)$/i
  );
  if (!m) return null;
  const width_mm = parseFloat(m[1].replace(",", "."));
  const height_mm = parseFloat(m[2].replace(",", "."));
  if (!Number.isFinite(width_mm) || !Number.isFinite(height_mm)) return null;
  if (width_mm <= 0 || height_mm <= 0) return null;
  return { width_mm, height_mm };
}

/**
 * Fallback z poznámky: „?80,5mm“, „(109,7x69,35mm)“, „95,59x67,54mm“.
 * Preferuje pár Š×V; jinak kruh jako Š=V.
 */
export function parseFormatMmFromNote(
  note: string
): { width_mm: number; height_mm: number } | null {
  if (!note.trim()) return null;
  const pair = note.match(
    /(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*mm/i
  );
  if (pair) {
    const width_mm = parseFloat(pair[1].replace(",", "."));
    const height_mm = parseFloat(pair[2].replace(",", "."));
    if (Number.isFinite(width_mm) && Number.isFinite(height_mm) && width_mm > 0 && height_mm > 0) {
      return { width_mm, height_mm };
    }
  }
  const circle = note.match(/[øØ?]?\s*(\d+(?:[.,]\d+)?)\s*mm/i);
  if (circle) {
    const d = parseFloat(circle[1].replace(",", "."));
    if (Number.isFinite(d) && d > 0) return { width_mm: d, height_mm: d };
  }
  return null;
}

export function mapShapeTypeLabel(
  raw: string,
  shapeCode: string
): ImlShapeType {
  const t = raw.trim().toLocaleLowerCase("cs");
  if (t === "vanička" || t === "vanicka" || t === "cup") return "CUP";
  if (t === "víčko" || t === "vicko" || t === "lid") return "LID";
  if (t === "obvodovka" || t === "wrap") return "WRAP";
  if (isImlShapeType(raw.trim().toUpperCase())) {
    return raw.trim().toUpperCase() as ImlShapeType;
  }
  const code = shapeCode.toUpperCase();
  if (code.includes("-CUP-") || code.startsWith("IML-CUP")) return "CUP";
  if (code.includes("-LID-") || code.startsWith("IML-LID")) return "LID";
  if (code.includes("-WRAP-")) return "WRAP";
  return "OTHER";
}

export function resolveImportTechnology(raw: string): ImlToolTechnology {
  if (!raw.trim()) return "PROTLACOVAK_RUCNI";
  if (isImlToolTechnology(raw.trim())) return raw.trim() as ImlToolTechnology;
  const upper = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (isImlToolTechnology(upper)) return upper;
  return mapLegacyMachineToTechnology(raw) ?? "PROTLACOVAK_RUCNI";
}

/** Rozdělí „Vavřík, Dostál, Váhala“ — neštípá desetinné čárky v mm. */
export function splitCustomerNames(raw: string): string[] {
  if (!raw.trim()) return [];
  // Pokud vypadá jako rozměr / technická poznámka bez jména firmy, neimportovat jako zákazníky
  if (/^\s*[A-Za-z0-9].*\d+[.,]?\d*\s*mm/i.test(raw) && !/,/.test(raw.split("mm")[0] ?? "")) {
    // např. "Víčko - Les Glaces (109,7x69,35mm)" — zkusit jméno před závorkou
    const beforeParen = raw.split("(")[0]?.replace(/^[^A-Za-zÁ-ž]+/, "").trim();
    if (beforeParen && beforeParen.length >= 2 && !/\d+\s*[x×]/i.test(beforeParen)) {
      return [beforeParen.replace(/\s*-\s*$/, "").trim()].filter(Boolean);
    }
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => !/^\d/.test(s) || /[A-Za-zÁ-ž]/.test(s));
}

export type ParsedShapeImportRow = {
  shape_code: string;
  tool_code: string;
  shape_type: ImlShapeType;
  width_mm: number;
  height_mm: number;
  technology: ImlToolTechnology;
  customer_names: string[];
  internal_note: string | null;
  format_from_note: boolean;
};

export function parseShapeImportRow(
  row: unknown[],
  mapping: ShapeColumnMapping
): ParsedShapeImportRow | { error: string } {
  const shape_code = cell(row, mapping.shape_code).slice(0, 30);
  const tool_code = cell(row, mapping.tool_code).slice(0, 30);
  if (!shape_code) return { error: "Chybí kód tvaru" };
  if (!tool_code) return { error: "Chybí kód nástroje" };

  const customersRaw = cell(row, mapping.customers);
  const noteRaw = cell(row, mapping.note);
  const formatRaw = cell(row, mapping.format);

  let dims = parseFormatMm(formatRaw);
  let format_from_note = false;
  if (!dims) {
    dims = parseFormatMmFromNote(customersRaw) ?? parseFormatMmFromNote(noteRaw);
    format_from_note = dims != null;
  }
  if (!dims) {
    return {
      error: `Nelze parsovat rozměry z „${formatRaw || "(prázdné)"}“ ani z poznámky`,
    };
  }

  const shape_type = mapShapeTypeLabel(cell(row, mapping.shape_type), shape_code);
  const technology = resolveImportTechnology(cell(row, mapping.technology));
  const customer_names = splitCustomerNames(customersRaw);

  const noteParts: string[] = [];
  if (noteRaw) noteParts.push(noteRaw);
  if (format_from_note && formatRaw) {
    noteParts.push(`Formát z Excelu: ${formatRaw}`);
  }
  if (customersRaw && customer_names.length === 0) {
    noteParts.push(customersRaw.slice(0, 200));
  }

  return {
    shape_code,
    tool_code,
    shape_type,
    width_mm: dims.width_mm,
    height_mm: dims.height_mm,
    technology,
    customer_names,
    internal_note: noteParts.length ? noteParts.join(" | ").slice(0, 255) : null,
    format_from_note,
  };
}
