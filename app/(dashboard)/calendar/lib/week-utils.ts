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

/**
 * Pro `<input type="datetime-local" />` — vždy místní kalendář a čas.
 * (toISOString() je v UTC a v CEST posune o jeden den oproti očekávání uživatele.)
 */
export function formatDateTimeLocalForInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

/**
 * Celodenní událost podle místních kalendářních dní (YYYY-MM-DD) → ISO do DB.
 */
export function allDayYmdRangeToIsoStrings(
  startYmd: string,
  endYmd: string
): { start: string; end: string } {
  const [ys, ms, ds] = startYmd.split("-").map(Number);
  const [ye, me, de] = endYmd.split("-").map(Number);
  const start = new Date(ys, ms - 1, ds, 0, 0, 0, 0);
  const end = new Date(ye, me - 1, de, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
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
