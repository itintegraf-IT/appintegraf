/** Aplikace běží v českém čase (včetně letního času). */
export const APP_TIMEZONE = "Europe/Prague";

const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function getPragueParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0;
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour,
    minute: parseInt(get("minute"), 10),
  };
}

/**
 * Hodnota pro `<input type="datetime-local" />` — vždy čas v Europe/Prague.
 * (toISOString() je UTC a v CEST posune o 2 hodiny.)
 */
export function formatDateTimeLocalForInput(d: Date): string {
  const p = getPragueParts(d);
  const y = String(p.year);
  const m = String(p.month).padStart(2, "0");
  const day = String(p.day).padStart(2, "0");
  const h = String(p.hour).padStart(2, "0");
  const min = String(p.minute).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

/**
 * Parsuje řetězec z datetime-local jako místní čas v Europe/Prague.
 */
export function parseDateTimeLocalInput(value: string): Date {
  const m = value.trim().match(DATETIME_LOCAL_RE);
  if (!m) return new Date(NaN);

  const target = {
    year: parseInt(m[1], 10),
    month: parseInt(m[2], 10),
    day: parseInt(m[3], 10),
    hour: parseInt(m[4], 10),
    minute: parseInt(m[5], 10),
  };

  let ts = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);

  for (let i = 0; i < 5; i++) {
    const p = getPragueParts(new Date(ts));
    if (
      p.year === target.year &&
      p.month === target.month &&
      p.day === target.day &&
      p.hour === target.hour &&
      p.minute === target.minute
    ) {
      return new Date(ts);
    }
    const diffMin =
      (target.year - p.year) * 525600 +
      (target.month - p.month) * 43200 +
      (target.day - p.day) * 1440 +
      (target.hour - p.hour) * 60 +
      (target.minute - p.minute);
    ts += diffMin * 60 * 1000;
  }

  return new Date(ts);
}

/** Zobrazení data a času pro uživatele (cs-CZ, Europe/Prague). */
export function formatDateTimeCz(
  d: Date,
  options?: Intl.DateTimeFormatOptions
): string {
  return d.toLocaleString("cs-CZ", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

/** Zobrazení data (cs-CZ, Europe/Prague). */
export function formatDateCz(
  d: Date,
  options?: Intl.DateTimeFormatOptions
): string {
  return d.toLocaleDateString("cs-CZ", {
    timeZone: APP_TIMEZONE,
    ...options,
  });
}

/** Zobrazení času HH:mm (cs-CZ, Europe/Prague). */
export function formatTimeCz(d: Date): string {
  return d.toLocaleTimeString("cs-CZ", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Začátek kalendářního dne YYYY-MM-DD v Europe/Prague. */
export function pragueDayStart(ymd: string): Date {
  return parseDateTimeLocalInput(`${ymd}T00:00`);
}

/** Konec kalendářního dne YYYY-MM-DD v Europe/Prague (23:59:59.999). */
export function pragueDayEnd(ymd: string): Date {
  const end = parseDateTimeLocalInput(`${ymd}T23:59`);
  end.setSeconds(59, 999);
  return end;
}

/** Přičte dní k YYYY-MM-DD (kalendářně, přes UTC poledne kvůli DST). */
export function addDaysToYmdPrague(ymd: string, days: number): string {
  const [y, m, day] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, day + days, 12, 0, 0, 0));
  return formatDateYmdPrague(t);
}

/** Celodenní rozsah podle kalendářních dní v Praze → ISO pro DB. */
export function allDayYmdRangeToIsoStrings(
  startYmd: string,
  endYmd: string
): { start: string; end: string } {
  const start = pragueDayStart(startYmd);
  const end = pragueDayEnd(endYmd);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Kalendářní den YYYY-MM-DD v Europe/Prague. */
export function formatDateYmdPrague(d: Date): string {
  const p = getPragueParts(d);
  const y = String(p.year);
  const m = String(p.month).padStart(2, "0");
  const day = String(p.day).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Hodina + zlomek minuty v Europe/Prague (pro pozicování v mřížce). */
export function getPragueHourFraction(d: Date): number {
  const p = getPragueParts(d);
  return p.hour + p.minute / 60;
}
