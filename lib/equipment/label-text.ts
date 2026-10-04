/**
 * Sazba textu na štítek — čistá logika bez DB; šířku textu měří volající (pdf-lib font).
 * Název se smí zkrátit s „…“, inventární číslo nikdy (jen se zmenší písmo).
 */

const ELLIPSIS = "…";

type Measure = (s: string) => number;

/** Text, který se vejde do šířky; jinak zkrácený s „…“ na konci. */
export function fitTextToWidth(text: string, maxWidth: number, measure: Measure): string {
  const t = text.trim();
  if (!t || maxWidth <= 0) return "";
  if (measure(t) <= maxWidth) return t;
  const chars = Array.from(t);
  while (chars.length > 0) {
    chars.pop();
    const candidate = `${chars.join("").trimEnd()}${ELLIPSIS}`;
    if (measure(candidate) <= maxWidth) return candidate;
  }
  return measure(ELLIPSIS) <= maxWidth ? ELLIPSIS : "";
}

type Token = { text: string; glue: boolean };

/** Rozdělí slova delší než šířka na kousky; `glue` = pokračování předchozího slova bez mezery. */
function tokenize(text: string, maxWidth: number, measure: Measure): Token[] {
  const tokens: Token[] = [];
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    if (measure(word) <= maxWidth) {
      tokens.push({ text: word, glue: false });
      continue;
    }
    let part = "";
    let first = true;
    for (const ch of Array.from(word)) {
      if (part && measure(part + ch) > maxWidth) {
        tokens.push({ text: part, glue: !first });
        first = false;
        part = ch;
      } else {
        part += ch;
      }
    }
    if (part) tokens.push({ text: part, glue: !first });
  }
  return tokens;
}

function join(tokens: Token[]): string {
  return tokens.reduce((acc, t, i) => (i === 0 ? t.text : `${acc}${t.glue ? "" : " "}${t.text}`), "");
}

/** Zalomí text po slovech do nejvýš `maxLines` řádků; zbytek posledního řádku zkrátí s „…“. */
export function wrapTextLines(text: string, maxWidth: number, maxLines: number, measure: Measure): string[] {
  if (maxLines <= 0 || maxWidth <= 0) return [];
  const tokens = tokenize(text, maxWidth, measure);
  if (tokens.length === 0) return [];

  const lines: string[] = [];
  let current: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const candidate = [...current, tokens[i]];
    if (current.length === 0 || measure(join(candidate)) <= maxWidth) {
      current = candidate;
      continue;
    }
    lines.push(join(current));
    current = [{ ...tokens[i], glue: false }];
    if (lines.length === maxLines - 1) {
      lines.push(fitTextToWidth(join([...current, ...tokens.slice(i + 1)]), maxWidth, measure));
      return lines;
    }
  }
  if (current.length > 0) lines.push(join(current));
  return lines;
}

/** Největší velikost písma ze `sizes` (sestupně), při které se text vejde; jinak nejmenší. */
export function fitFontSize(
  text: string,
  maxWidth: number,
  sizes: number[],
  measure: (s: string, size: number) => number
): number {
  for (const size of sizes) {
    if (measure(text, size) <= maxWidth) return size;
  }
  return sizes[sizes.length - 1];
}

export const DEFAULT_LABEL_OWNER_TEXT = "Majetek Integraf, s.r.o.";
export const LABEL_OWNER_TEXT_MAX = 40;

/** Text vlastníka na štítku: chybí → výchozí; prázdný = bez řádku vlastníka. */
export function normalizeLabelOwnerText(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_LABEL_OWNER_TEXT;
  return Array.from(raw.trim()).slice(0, LABEL_OWNER_TEXT_MAX).join("");
}
