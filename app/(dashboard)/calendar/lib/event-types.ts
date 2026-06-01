import {
  formatDateCz,
  formatDateYmdPrague,
  formatTimeCz,
  getPragueParts,
} from "@/lib/datetime-cz";

/**
 * Typy událostí kalendáře.
 * Hodnota = klíč v DB, label = zobrazení pro uživatele.
 */
export const EVENT_TYPES = [
  { value: "dovolena", label: "Dovolená" },
  { value: "osobni", label: "Osobní" },
  { value: "schuzka_mimo_firmu", label: "Schůzka mimo firmu" },
  { value: "schuzka_nachod", label: "Schůzka Náchod" },
  { value: "schuzka_praha", label: "Schůzka Praha" },
  { value: "sluzebni_cesta", label: "Služební cesta" },
  { value: "lekar", label: "Lékař" },
  { value: "nemoc", label: "Nemoc" },
  { value: "vzdelavani", label: "Vzdělávání" },
  { value: "jine", label: "Jiné" },
] as const;

export const DEFAULT_EVENT_TYPE = "jine";

export { getColorForEventType } from "@/lib/calendar-event-colors";

export function getEventTypeLabel(value: string | null): string {
  if (!value) return "Jiné";
  const found = EVENT_TYPES.find((t) => t.value === value);
  return found?.label ?? value;
}

/**
 * Typy, u kterých je zástup povinný a běží schvalovací workflow (zástup → příp. vedoucí).
 * Dříve jen Dovolená / Osobní; dále Schůzka Praha, Služební cesta, Lékař.
 */
export const DEPUTY_REQUIRED_TYPES = [
  "dovolena",
  "osobni",
  "schuzka_praha",
  "sluzebni_cesta",
  "lekar",
] as const;

export function requiresDeputy(eventType: string | null): boolean {
  return eventType !== null && DEPUTY_REQUIRED_TYPES.includes(eventType as (typeof DEPUTY_REQUIRED_TYPES)[number]);
}

/** U služební cesty musí být v popisu uvedeno kam a proč (schvalovatel). */
export function requiresBusinessTripDescription(eventType: string | null): boolean {
  return eventType === "sluzebni_cesta";
}

/** YYYY-MM-DD v UTC (pro porovnání „stejný kalendářní den v UTC“) */
function formatDateUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isUTCMidnight(d: Date): boolean {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

function isPragueMidnight(d: Date): boolean {
  const p = getPragueParts(d);
  return p.hour === 0 && p.minute === 0;
}

function isPragueEndOfDay(d: Date): boolean {
  const p = getPragueParts(d);
  return p.hour === 23 && p.minute >= 59;
}

function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, day] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, day + days, 12, 0, 0, 0));
  return formatDateYmdPrague(t);
}

function enumerateYmdInclusive(fromYmd: string, toYmd: string): string[] {
  const out: string[] = [];
  let cur = fromYmd;
  while (cur <= toYmd) {
    out.push(cur);
    if (cur === toYmd) break;
    cur = addDaysToYmd(cur, 1);
  }
  return out;
}

/**
 * Zda je událost celodenní (všechny kontroly v Europe/Prague, ne v TZ runtime).
 * - Prague 00:00 – konec 23:59+ (jeden i více kalendářních dní).
 * - Exkluzivní konec = Prague 00:00 následujícího dne.
 * - UTC půlnoč … půlnoč (+n dní) nebo UTC 23:59 téhož UTC dne.
 */
export function isAllDayEvent(start: Date, end: Date): boolean {
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return false;

  const startYmd = formatDateYmdPrague(start);
  const endYmd = formatDateYmdPrague(end);

  if (isPragueMidnight(start)) {
    if (isPragueEndOfDay(end)) return true;
    if (endYmd > startYmd) return true;
    if (startYmd === endYmd && diffMs >= 23 * 60 * 60 * 1000) return true;
    const pe = getPragueParts(end);
    if (pe.hour === 0 && pe.minute === 0 && end.getTime() > start.getTime()) {
      return endYmd > startYmd || diffMs >= 86400000 - 1000;
    }
  }

  if (isUTCMidnight(start) && isUTCMidnight(end) && end.getTime() > start.getTime()) {
    const n = diffMs / 86400000;
    if (n >= 1 && Math.abs(n - Math.round(n)) < 1e-6) {
      return true;
    }
  }

  if (isUTCMidnight(start)) {
    if (end.getUTCHours() === 23 && end.getUTCMinutes() >= 59) {
      return true;
    }
    if (
      formatDateUTC(start) === formatDateUTC(end) &&
      diffMs >= 20 * 60 * 60 * 1000 &&
      diffMs <= 26 * 60 * 60 * 1000
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Kalendářní dny YYYY-MM-DD (Europe/Prague) pro řádek „Celý den“.
 */
export function allDayEventDisplayDates(start: Date, end: Date): string[] {
  if (!isAllDayEvent(start, end)) return [];

  const startYmd = formatDateYmdPrague(start);
  const endYmd = formatDateYmdPrague(end);

  if (isUTCMidnight(start) && isUTCMidnight(end) && end.getTime() > start.getTime()) {
    const n = Math.round((end.getTime() - start.getTime()) / 86400000);
    if (n >= 1) {
      return Array.from({ length: n }, (_, k) => {
        const t = new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + k, 12, 0, 0, 0)
        );
        return formatDateYmdPrague(t);
      });
    }
  }

  if (isPragueMidnight(start) && isPragueMidnight(end) && end.getTime() > start.getTime() && endYmd > startYmd) {
    const out: string[] = [];
    let cur = startYmd;
    while (cur < endYmd) {
      out.push(cur);
      cur = addDaysToYmd(cur, 1);
    }
    if (out.length > 0) return out;
  }

  return enumerateYmdInclusive(startYmd, endYmd);
}

const LIST_DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "numeric",
  year: "numeric",
};

/** Sloupec Datum v seznamu / vyhledávání. */
export function formatCalendarListDateCell(start: Date, end: Date): string {
  if (!isAllDayEvent(start, end)) {
    return formatDateCz(start, LIST_DATE_OPTS);
  }
  const startYmd = formatDateYmdPrague(start);
  const endYmd = formatDateYmdPrague(end);
  if (startYmd === endYmd) {
    return formatDateCz(start, LIST_DATE_OPTS);
  }
  return `${formatDateCz(start, LIST_DATE_OPTS)} – ${formatDateCz(end, LIST_DATE_OPTS)}`;
}

/** Sloupec Čas v seznamu / vyhledávání. */
export function formatCalendarListTimeCell(start: Date, end: Date): string {
  if (isAllDayEvent(start, end)) return "Celý den";
  return `${formatTimeCz(start)} – ${formatTimeCz(end)}`;
}
