import { normalizePantoneCode, isValidPantoneCode } from "@/lib/iml-pantone";

export type ParsedPrintColorRow = {
  code: string;
  coverage_pct: string;
};

/**
 * Z textového souhrnu barev (import / print_colors_text) odvodí řádky Pantone.
 * CMYK část se přeskočí – procesní barvy řeší přepínače v UI.
 */
export function pantoneRowsFromPrintColorsText(text: string | null | undefined): ParsedPrintColorRow[] {
  if (!text?.trim()) return [];

  const rows: ParsedPrintColorRow[] = [];
  const parts = text.split(/\s*\+\s*/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const upper = trimmed.toUpperCase();
    if (upper === "CMYK" || /^[CMYK]+$/.test(upper.replace(/\s/g, ""))) {
      continue;
    }

    const covMatch = trimmed.match(/\s+(\d+(?:[.,]\d+)?)\s*%?\s*$/);
    if (covMatch) {
      const coverage = covMatch[1].replace(",", ".");
      const codeRaw = trimmed.slice(0, trimmed.length - covMatch[0].length).trim();
      const code = normalizePantoneCode(codeRaw);
      if (isValidPantoneCode(code)) {
        rows.push({ code, coverage_pct: coverage });
      }
      continue;
    }

    const code = normalizePantoneCode(trimmed);
    if (isValidPantoneCode(code)) {
      rows.push({ code, coverage_pct: "" });
    }
  }

  return rows;
}
