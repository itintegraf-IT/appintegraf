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

/** Druh produktu v katalogu IML (`iml_products.product_kind`). */
export const IML_PRODUCT_KINDS = [
  { value: "iml", label: "IML (plast)" },
  { value: "etikety", label: "Etikety (papír)" },
] as const;

export type ImlProductKind = (typeof IML_PRODUCT_KINDS)[number]["value"];

export const DEFAULT_IML_PRODUCT_KIND: ImlProductKind = "iml";

export function imlProductKindLabel(value: string | null | undefined): string {
  if (!value) return imlProductKindLabel(DEFAULT_IML_PRODUCT_KIND);
  return IML_PRODUCT_KINDS.find((k) => k.value === value)?.label ?? value;
}

/** Stav schválení tiskových dat (`iml_products.approval_status`). */
export const IML_APPROVAL_STATUSES = [
  "máme",
  "nemáme",
  "řeší grafik",
] as const;

export type ImlApprovalStatus = (typeof IML_APPROVAL_STATUSES)[number];

/** Počet barev na záložce Tisková data (`iml_products.color_count`). */
export const IML_COLOR_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
