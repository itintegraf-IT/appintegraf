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
