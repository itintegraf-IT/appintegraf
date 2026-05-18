export const MATERIAL_CATEGORIES = [
  { code: "PAPER", label: "Papír", slug: "papir" },
  { code: "FOIL", label: "Fólie", slug: "foilie" },
  { code: "COLOR", label: "Barvy", slug: "barvy" },
  { code: "LACQUER", label: "Laky", slug: "laky" },
] as const;

export type MaterialCategoryCode = (typeof MATERIAL_CATEGORIES)[number]["code"];

export function isMaterialCategoryCode(v: string): v is MaterialCategoryCode {
  return MATERIAL_CATEGORIES.some((c) => c.code === v);
}

export function materialCategorySlug(code: string): string {
  return MATERIAL_CATEGORIES.find((c) => c.code === code)?.slug ?? "materialy";
}

export const DOCUMENT_TYPES = [
  { value: "SDS", label: "Bezpečnostní list (SDS)" },
  { value: "TDS", label: "Technický list (TDS)" },
  { value: "CERTIFICATE", label: "Certifikát" },
  { value: "OTHER", label: "Jiný dokument" },
] as const;
