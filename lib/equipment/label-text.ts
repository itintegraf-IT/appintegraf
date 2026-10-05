/**
 * Sazba textu na štítek — čistá logika bez DB; šířku textu měří volající (pdf-lib font).
 * Název se smí zkrátit s „…“, inventární číslo nikdy (zmenší se písmo, případně se zalomí).
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

/** Rozdělí text po znacích na řádky, které se vejdou do šířky — nic nevynechá. */
function splitToWidth(text: string, maxWidth: number, measure: Measure): string[] {
  const lines: string[] = [];
  let current = "";
  for (const ch of Array.from(text)) {
    if (current && measure(current + ch) > maxWidth) {
      lines.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Inventární číslo na štítek: největší písmo ze `sizes` (sestupně), při kterém se vejde
 * na jeden řádek; jinak největší, při kterém se vejde na dva řádky; jinak nejmenší písmo
 * a tolik řádků, kolik je třeba. Číslo se nikdy nezkracuje ani nepřeteče do šířky.
 */
export function fitCodeLines(
  text: string,
  maxWidth: number,
  sizes: number[],
  measure: (s: string, size: number) => number
): { size: number; lines: string[] } {
  const code = text.trim();
  for (const size of sizes) {
    if (measure(code, size) <= maxWidth) return { size, lines: [code] };
  }
  for (const size of sizes) {
    const lines = splitToWidth(code, maxWidth, (s) => measure(s, size));
    if (lines.length <= 2) return { size, lines };
  }
  const smallest = sizes[sizes.length - 1];
  return { size: smallest, lines: splitToWidth(code, maxWidth, (s) => measure(s, smallest)) };
}

export const DEFAULT_LABEL_OWNER_TEXT = "Majetek Integraf, s.r.o.";
export const LABEL_OWNER_TEXT_MAX = 40;

/** Text vlastníka na štítku: chybí → výchozí; prázdný = bez řádku vlastníka. */
export function normalizeLabelOwnerText(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_LABEL_OWNER_TEXT;
  return Array.from(raw.trim()).slice(0, LABEL_OWNER_TEXT_MAX).join("");
}

/** „1 štítek“, „3 štítky“, „5 štítků“. */
export function labelsCountLabel(n: number): string {
  if (n === 1) return "1 štítek";
  if (n >= 2 && n <= 4) return `${n} štítky`;
  return `${n} štítků`;
}
