/**
 * Normalizace textu pro párování (názvy místností, jména) — čistá logika bez DB,
 * použitelná i v klientu (na rozdíl od excel-import.ts, který táhne knihovnu xlsx).
 */

export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Bez diakritiky, malá písmena, jedna mezera (i místo NBSP), sjednocené pomlčky mezi slovy. */
export function normalizeForMatch(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[ \s]+/g, " ")
    .replace(/\s*[–—‑]\s*/g, " - ")
    .replace(/\s+-\s+/g, " - ")
    .trim();
}
