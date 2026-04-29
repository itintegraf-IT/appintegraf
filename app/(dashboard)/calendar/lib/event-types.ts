import { formatDateLocal } from "./week-utils";

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

function isLocalMidnight(d: Date): boolean {
  return d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;
}

/**
 * Zda je událost celodenní.
 * - Lokální 00:00 a konec téhož dne (23:59+) – klasické uložení z formuláře.
 * - Nebo půlnoč až půlnoč o den dál (lokálně i UTC) – běžná exkluzivní konvence konec = začátek následujícího dne.
 * - UTC půlnoč (00:00:00Z) a konec téhož kalendářního dne v UTC (23:59) – běžné po `Date` z DB/JSON
 *   (v CEST pak začátek vypadá jako 01:00 nebo 02:00, ale není to časový slot).
 * - Příp. délka ~n×24 h a začátek v UTC 00:00 (více celých dní = [UTC, UTC+n)).
 */
export function isAllDayEvent(start: Date, end: Date): boolean {
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return false;

  const sh = start.getHours();
  const sm = start.getMinutes();
  const eh = end.getHours();
  const em = end.getMinutes();
  if (sh === 0 && sm === 0 && ((eh === 23 && em >= 59) || diffMs >= 23 * 60 * 60 * 1000)) {
    return true;
  }

  if (isUTCMidnight(start) && isUTCMidnight(end) && end.getTime() > start.getTime()) {
    const n = diffMs / 86400000;
    if (n >= 1 && Math.abs(n - Math.round(n)) < 1e-6) {
      return true;
    }
  }

  const utcH = start.getUTCHours();
  const utcM = start.getUTCMinutes();
  const utcS = start.getUTCSeconds();
  const utcMS = start.getUTCMilliseconds();
  if (utcH !== 0 || utcM !== 0 || utcS !== 0 || utcMS !== 0) {
    return false;
  }

  if (end.getUTCHours() === 23 && end.getUTCMinutes() >= 59) {
    return true;
  }
  if (eh === 23 && em >= 59) {
    return true;
  }
  if (formatDateUTC(start) === formatDateUTC(end) && diffMs >= 20 * 60 * 60 * 1000 && diffMs <= 26 * 60 * 60 * 1000) {
    return true;
  }
  return false;
}

/**
 * Lokální kalendářní dny (YYYY-MM-DD), ve kterých se má událost zobrazit v řádku „Celý den“
 * (aby se u [0:00, následující den 0:00) nezdvojil sloupec).
 */
export function allDayEventDisplayDates(start: Date, end: Date): string[] {
  if (!isAllDayEvent(start, end)) return [];

  if (isUTCMidnight(start) && isUTCMidnight(end) && end.getTime() > start.getTime()) {
    const diffMs = end.getTime() - start.getTime();
    const n = Math.round(diffMs / 86400000);
    if (n >= 1) {
      return Array.from({ length: n }, (_, k) => {
        const t = new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + k, 12, 0, 0, 0)
        );
        return formatDateLocal(t);
      });
    }
  }

  if (isLocalMidnight(start) && isLocalMidnight(end) && end.getTime() > start.getTime()) {
    const out: string[] = [];
    const cur = new Date(start);
    while (cur < end) {
      out.push(formatDateLocal(cur));
      cur.setDate(cur.getDate() + 1);
      cur.setHours(0, 0, 0, 0);
    }
    return out;
  }

  if (formatDateLocal(start) === formatDateLocal(end)) {
    return [formatDateLocal(start)];
  }

  /** Jeden kalendářní den v UTC (časté 00:00Z…23:59Z) i když lokální datum začátku a konce není shodné (konec poskočí na „druhý“ místní den v CEST) */
  if (formatDateUTC(start) === formatDateUTC(end)) {
    const t = new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        start.getUTCDate(),
        12,
        0,
        0,
        0
      )
    );
    return [formatDateLocal(t)];
  }

  const out: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= endDay) {
    out.push(formatDateLocal(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
