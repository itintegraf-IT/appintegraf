/** Typy událostí = uživatel mimo firmu / nedostupný pro schvalování. */
export const CALENDAR_OUT_OF_OFFICE_TYPES = [
  "dovolena",
  "osobni",
  "schuzka_mimo_firmu",
  "schuzka_praha",
  "sluzebni_cesta",
  "lekar",
  "nemoc",
] as const;

export type CalendarOutOfOfficeType = (typeof CALENDAR_OUT_OF_OFFICE_TYPES)[number];
