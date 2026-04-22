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
