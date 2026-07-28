/**
 * Sdílené konstanty modulu IT Školení.
 * Prisma enum `questions_difficulty` má mapované hodnoty (snadná/střední/těžká),
 * klient ale pracuje s identifikátory schématu.
 */

export type DifficultyKey = "snadn_" | "st_edn_" | "t__k_";
export type AnswerKey = "A" | "B" | "C" | "D";

export const DIFFICULTY_LABELS: Record<DifficultyKey, string> = {
  snadn_: "snadná",
  st_edn_: "střední",
  t__k_: "těžká",
};

export const DIFFICULTY_KEYS = Object.keys(DIFFICULTY_LABELS) as DifficultyKey[];

export const ANSWER_KEYS: AnswerKey[] = ["A", "B", "C", "D"];

export function isAnswerKey(value: unknown): value is AnswerKey {
  return typeof value === "string" && (ANSWER_KEYS as string[]).includes(value);
}

export function isDifficultyKey(value: unknown): value is DifficultyKey {
  return typeof value === "string" && (DIFFICULTY_KEYS as string[]).includes(value);
}

/** Převod textového vstupu (např. z CSV) na klíč obtížnosti. */
export function difficultyFromLabel(value: string): DifficultyKey | null {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!normalized) return null;
  if (["snadna", "snadny", "lehka", "easy", "1"].includes(normalized)) return "snadn_";
  if (["stredni", "medium", "2"].includes(normalized)) return "st_edn_";
  if (["tezka", "hard", "3"].includes(normalized)) return "t__k_";
  return null;
}
