/** Sdílené pomocné funkce parserů PDF objednávek. */

/**
 * České/evropské číslo: mezery a tečky = oddělovače tisíců, čárka = desetinná.
 * "330 000,00" → 330000, "22.000" → 22000, "0,33" → 0.33
 */
export function parseCzNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/[\s.]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** "25.03.2026" → "2026-03-25". */
export function parseCzDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** "13-11-2025" → "2025-11-13". */
export function parseDashDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** Rozdělí text na řádky, tabulátory → mezery, sloučí whitespace. */
export function normalizeLines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.replace(/\t/g, " ").replace(/\s+/g, " ").trim());
}
