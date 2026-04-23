const EVENT_TYPE_COLOR_MAP: Record<string, string> = {
  dovolena: "#EA580C",
  osobni: "#7C3AED",
  schuzka_mimo_firmu: "#2563EB",
  schuzka_nachod: "#059669",
  schuzka_praha: "#0D9488",
  sluzebni_cesta: "#CA8A04",
  lekar: "#DB2777",
  nemoc: "#DC2626",
  vzdelavani: "#4F46E5",
  jine: "#6B7280",
};

const FALLBACK = "#6B7280";

/** Barva mřížky / kalendáře podle typu události. */
export function getColorForEventType(value: string | null | undefined): string {
  if (!value) return FALLBACK;
  return EVENT_TYPE_COLOR_MAP[value] ?? FALLBACK;
}
