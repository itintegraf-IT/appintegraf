/**
 * Typy událostí kalendáře.
 * Hodnota = klíč v DB, label = zobrazení pro uživatele.
 */
export const EVENT_TYPES = [
  { value: "dovolena", label: "Dovolená" },
  { value: "osobni", label: "Osobní" },
  { value: "schuzka_mimo_firmu", label: "Schůzka mimo firmu" },
  { value: "sluzebni_cesta", label: "Služební cesta" },
  { value: "lekar", label: "Lékař" },
  { value: "nemoc", label: "Nemoc" },
  { value: "jine", label: "Jiné" },
] as const;

export const DEFAULT_EVENT_TYPE = "jine";

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

/** Zda je událost celodenní (začátek 00:00, konec 23:59 nebo délka ≥ 24 h) */
export function isAllDayEvent(start: Date, end: Date): boolean {
  const sh = start.getHours();
  const sm = start.getMinutes();
  const eh = end.getHours();
  const em = end.getMinutes();
  return (
    sh === 0 &&
    sm === 0 &&
    ((eh === 23 && em >= 59) || end.getTime() - start.getTime() >= 23 * 60 * 60 * 1000)
  );
}
