/** Výchozí čtyři skupiny (zápis do DB při prázdné tabulce). */
export const DEFAULT_MATERIAL_CATEGORIES = [
  { code: "PAPER", label: "Papír", slug: "papir", sort_order: 1 },
  { code: "FOIL", label: "Fólie", slug: "foilie", sort_order: 2 },
  { code: "COLOR", label: "Barvy", slug: "barvy", sort_order: 3 },
  { code: "LACQUER", label: "Laky", slug: "laky", sort_order: 4 },
] as const;

export type MaterialCategoryRow = {
  code: string;
  label: string;
  slug: string;
  sort_order: number;
};

/** Kód kategorie materiálu (dynamický seznam z DB). */
export type MaterialCategoryCode = string;

/** @deprecated Použijte getMaterialCategories() – statický seznam jen pro zpětnou kompatibilitu. */
export const MATERIAL_CATEGORIES: MaterialCategoryRow[] = [...DEFAULT_MATERIAL_CATEGORIES];

export function normalizeCategoryCode(raw: string, label?: string): string {
  let code = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (!code && label) {
    const base = label
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    code = base.slice(0, 20);
  }
  return code.slice(0, 20);
}

export function slugifyCategoryLabel(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "skupina";
}

export function materialCategorySlug(code: string, categories?: MaterialCategoryRow[]): string {
  const list = categories ?? MATERIAL_CATEGORIES;
  return list.find((c) => c.code === code)?.slug ?? "materialy";
}

export const DOCUMENT_TYPES = [
  { value: "SDS", label: "Bezpečnostní list (SDS)" },
  { value: "TDS", label: "Technický list (TDS)" },
  { value: "CERTIFICATE", label: "Certifikát" },
  { value: "OTHER", label: "Jiný dokument" },
] as const;
