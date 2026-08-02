/**
 * Jediný zdroj pravdy pro prioritu karty v modulu Projekty.
 * Priorita je nullable — `null` znamená „bez priority" (výchozí stav karty),
 * ne „nejnižší". Proto se v řazení vždy propadá na konec.
 */

export const CARD_PRIORITIES = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;

export type CardPriorityValue = (typeof CARD_PRIORITIES)[number];

/** Nižší číslo = naléhavější. `null` dostává Infinity → řadí se na konec. */
const PRIORITY_RANK: Record<CardPriorityValue, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export const PRIORITY_LABELS: Record<CardPriorityValue, string> = {
  URGENT: "Urgentní",
  HIGH: "Vysoká",
  MEDIUM: "Střední",
  LOW: "Nízká",
};

/**
 * Plná sytost barev je v modulu vyhrazená statusům, prioritám a urgentním
 * termínům (viz components/projekty/CLAUDE.md). Dark mode přes poloprůhledný
 * sytý tón, ne tmavou paletu.
 */
export const PRIORITY_CHIP_CLASSES: Record<CardPriorityValue, string> = {
  URGENT: "bg-red-500/15 text-red-700 dark:text-red-400",
  HIGH: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  MEDIUM: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  LOW: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

/** Plná barva tečky — kompaktní varianta chipu na kanban kartě. */
export const PRIORITY_DOT_CLASSES: Record<CardPriorityValue, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-blue-500",
  LOW: "bg-slate-400",
};

/**
 * Tytéž barvy jako PRIORITY_DOT_CLASSES, ale jako CSS hodnota — pro místa,
 * kde se barva předává inline stylem (hlavičky skupin v list view).
 */
export const PRIORITY_DOT_CSS: Record<CardPriorityValue, string> = {
  URGENT: "hsl(0 84% 60%)",
  HIGH: "hsl(25 95% 53%)",
  MEDIUM: "hsl(217 91% 60%)",
  LOW: "hsl(215 20% 65%)",
};

export function isCardPriority(value: unknown): value is CardPriorityValue {
  return typeof value === "string" && (CARD_PRIORITIES as readonly string[]).includes(value);
}

/** Bezpečný převod hodnoty z URL / API na prioritu (jinak `null`). */
export function parsePriority(value: unknown): CardPriorityValue | null {
  return isCardPriority(value) ? value : null;
}

export function priorityRank(p: CardPriorityValue | null | undefined): number {
  return p ? PRIORITY_RANK[p] : Number.POSITIVE_INFINITY;
}

/**
 * Komparátor pro Array.prototype.sort — naléhavější první, bez priority poslední.
 * Karty bez priority se navzájem neřadí (vrací 0), o pořadí rozhoduje až
 * navazující kritérium volajícího.
 */
export function comparePriority(
  a: CardPriorityValue | null | undefined,
  b: CardPriorityValue | null | undefined,
): number {
  const ra = priorityRank(a);
  const rb = priorityRank(b);
  if (ra === rb) return 0;
  return ra < rb ? -1 : 1;
}
