/**
 * Konstanty modulu IML – enum-like definice sdílené mezi UI komponentami
 * a (volitelně) API validací. Bez externích závislostí, aby to šlo použít
 * jak na klientovi, tak na serveru.
 */

/**
 * Povolené stavy IML položky (`iml_products.item_status`).
 * Pořadí ovlivňuje výchozí řazení v <select>.
 */
export const IML_ITEM_STATUSES = [
  "aktivní",
  "archivní",
  "testovací",
  "zablokovaná",
  "rozpracováno grafikem",
  "chyba",
] as const;

export type ImlItemStatus = (typeof IML_ITEM_STATUSES)[number];

/**
 * Label pro <option> – v tuto chvíli jen capitalized value, ale necháváme
 * jako funkci, kdyby bylo potřeba i18n / pretty-printing.
 */
export function imlItemStatusLabel(status: string): string {
  if (!status) return "";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Typ etikety na záložce Tisková data (`iml_products.label_type`). */
export const IML_LABEL_TYPES = [
  { value: "rezana", label: "Řezaná" },
  { value: "s_vysekem", label: "S výsekem" },
] as const;

export type ImlLabelType = (typeof IML_LABEL_TYPES)[number]["value"];

export function imlLabelTypeLabel(value: string | null | undefined): string {
  if (!value) return "";
  return IML_LABEL_TYPES.find((t) => t.value === value)?.label ?? value;
}
