/**
 * Normalizace a validace Pantone kódů pro IML modul.
 * Specifikace: docs/IML_NEWSEC_IMPLEMENTATION.md, Příloha C.2.
 */

/**
 * Znormalizuje Pantone kód do kanonické podoby:
 *   - trim
 *   - toUpperCase
 *   - sloučení whitespace na jednu mezeru
 *   - pokud začíná "P" přímo následovaným číslicí ("P1234"), vloží mezeru → "P 1234"
 *     (rozlišujeme od slova "PANTONE..." – tam P následuje A)
 *
 * Příklady:
 *   "  pantone 485 C " → "PANTONE 485 C"
 *   "p1234"            → "P 1234"
 *   "P 485 C"          → "P 485 C"
 */
export function normalizePantoneCode(raw: string): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/^P(?=\d)/, "P ");
}

/**
 * Základní syntaktická validace normalizovaného Pantone kódu:
 *   - neprázdný
 *   - max 32 znaků (odpovídá VARCHAR(32) v DB)
 *   - povoleny alfanumerické znaky + mezera + pomlčka
 */
export function isValidPantoneCode(normalized: string): boolean {
  if (!normalized || normalized.length === 0 || normalized.length > 32) return false;
  return /^[A-Z0-9 \-]+$/.test(normalized);
}

const HEX6_RE = /^#[0-9A-Fa-f]{6}$/;

/** Orientační barvy procesních kanálů CMYK (když v číselníku chybí hex). */
const PROCESS_CHANNEL_HEX: Record<string, string> = {
  C: "#00A3E0",
  M: "#EC008C",
  Y: "#FFE800",
  K: "#1A1A1A",
};

/**
 * Vrátí hex pro vzorek barvy: nejdřív hodnota z DB, jinak procesní C/M/Y/K.
 * U běžných Pantone kódů bez hex vrací null (barvu z kódu nelze spolehlivě odvodit).
 */
export function resolvePantoneSwatchHex(
  code: string | null | undefined,
  hexFromDb?: string | null
): string | null {
  if (hexFromDb && HEX6_RE.test(hexFromDb.trim())) {
    return hexFromDb.trim().toUpperCase();
  }
  const normalized = normalizePantoneCode(code ?? "");
  if (!normalized) return null;

  if (PROCESS_CHANNEL_HEX[normalized]) {
    return PROCESS_CHANNEL_HEX[normalized];
  }

  // např. "PROCESS BLACK", "BLACK"
  if (normalized === "BLACK" || normalized.startsWith("BLACK ") || normalized.includes("PROCESS BLACK")) {
    return PROCESS_CHANNEL_HEX.K;
  }

  return null;
}

export function isValidHexColor(hex: string | null | undefined): boolean {
  return !!hex && HEX6_RE.test(hex.trim());
}
