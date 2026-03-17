/**
 * Pomocné funkce pro práci s týdenním zobrazením kalendáře.
 * Týden = pondělí – neděle (český standard).
 */

/** Formátuje datum jako YYYY-MM-DD v lokální časové zóně (toISOString používá UTC a může posunout den). */
export function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parsuje řetězec YYYY-MM-DD jako lokální datum (ne UTC). */
export function parseDateLocal(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function getPrevWeek(from: Date): { from: Date; to: Date } {
  const prev = new Date(from);
  prev.setDate(prev.getDate() - 7);
  return { from: getWeekStart(prev), to: getWeekEnd(prev) };
}

export function getNextWeek(from: Date): { from: Date; to: Date } {
  const next = new Date(from);
  next.setDate(next.getDate() + 7);
  return { from: getWeekStart(next), to: getWeekEnd(next) };
}

export function getCurrentWeek(): { from: Date; to: Date } {
  const now = new Date();
  return { from: getWeekStart(now), to: getWeekEnd(now) };
}

export function formatWeekRange(from: Date, to: Date): string {
  const fromStr = from.toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" });
  const toStr = to.toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" });
  return `${fromStr} – ${toStr}`;
}

export const WEEKDAY_NAMES = ["ne", "po", "út", "st", "čt", "pá", "so"] as const;

/** Pro měsíční mřížku – pondělí první */
export const WEEKDAY_NAMES_MONDAY = ["po", "út", "st", "čt", "pá", "so", "ne"] as const;
