/**
 * Výpočet spotřeby barvy pro IML etikety.
 * Referenční algoritmus je popsán v docs/IML_NEWSEC_IMPLEMENTATION.md, Příloha C.1.
 *
 * Vzorec:
 *   sheets         = pieces / labelsPerSheet                       (přibližný počet TA)
 *   fullCoverageKg = (sheets / 1000) * FULL_COVERAGE_KG_PER_1000_SHEETS
 *   result         = fullCoverageKg * (coveragePct / 100)
 *
 * Konstanta 1,2 kg na 1000 celoplošně tisknutých archů je ZÁVAZNÁ (nevymýšlet).
 */

export const FULL_COVERAGE_KG_PER_1000_SHEETS = 1.2;

/**
 * Spotřeba jedné Pantone barvy pro daný náklad produktu.
 *
 * @param pieces         Náklad (počet etiket v objednávce). Musí být > 0.
 * @param labelsPerSheet Počet etiket na tiskový arch (iml_products.labels_per_sheet).
 *                       Pokud není vyplněno (NULL, 0, záporné, NaN), nelze spočítat → null.
 * @param coveragePct    Pokrytí barvy v % (0–100, NE 0–1).
 * @returns Spotřeba v kg, zaokrouhleno na 4 des. místa.
 *          Vrací null, pokud nelze spočítat (chybějící/neplatné vstupy).
 */
export function consumptionKg(
  pieces: number,
  labelsPerSheet: number | null | undefined,
  coveragePct: number
): number | null {
  if (!Number.isFinite(pieces) || pieces <= 0) return null;
  if (
    labelsPerSheet == null ||
    !Number.isFinite(labelsPerSheet) ||
    labelsPerSheet <= 0
  ) {
    return null;
  }
  if (!Number.isFinite(coveragePct) || coveragePct < 0) return null;

  const sheets = pieces / labelsPerSheet;
  const fullCoverageKg = (sheets / 1000) * FULL_COVERAGE_KG_PER_1000_SHEETS;
  const result = fullCoverageKg * (coveragePct / 100);

  return Math.round(result * 10000) / 10000;
}
