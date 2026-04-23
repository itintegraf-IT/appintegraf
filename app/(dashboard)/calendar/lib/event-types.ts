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

/** Typy, u kterých je zástup povinný */
export const DEPUTY_REQUIRED_TYPES = ["dovolena", "osobni"] as const;

export function requiresDeputy(eventType: string | null): boolean {
  return eventType !== null && DEPUTY_REQUIRED_TYPES.includes(eventType as (typeof DEPUTY_REQUIRED_TYPES)[number]);
}

/** YYYY-MM-DD v UTC (pro porovnání „stejný kalendářní den v UTC“) */
function formatDateUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Zda je událost celodenní.
 * - Lokální 00:00 a konec téhož dne (23:59+) – klasické uložení z formuláře.
 * - UTC půlnoč (00:00:00Z) a konec téhož kalendářního dne v UTC (23:59) – běžné po `Date` z DB/JSON
 *   (v CEST pak začátek vypadá jako 01:00 nebo 02:00, ale není to časový slot).
 * - Příp. délka ~n×24 h a začátek v UTC 00:00 (více celých dní).
 */
export function isAllDayEvent(start: Date, end: Date): boolean {
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return false;

  const sh = start.getHours();
  const sm = start.getMinutes();
  const eh = end.getHours();
  const em = end.getMinutes();
  if (
    sh === 0 &&
    sm === 0 &&
    ((eh === 23 && em >= 59) || diffMs >= 23 * 60 * 60 * 1000)
  ) {
    return true;
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
