export const IML_UNIT_TYPES = ["standalone", "headquarters", "branch"] as const;
export type ImlUnitType = (typeof IML_UNIT_TYPES)[number];

export const IML_EMAIL_KINDS = ["general", "billing", "orders"] as const;
export type ImlEmailKind = (typeof IML_EMAIL_KINDS)[number];

export function isImlUnitType(v: string): v is ImlUnitType {
  return (IML_UNIT_TYPES as readonly string[]).includes(v);
}

import { EU_VAT_PREFIXES, isEuTaxCountry } from "@/lib/iml-eu-tax";

export function isImlEmailKind(v: string): v is ImlEmailKind {
  return (IML_EMAIL_KINDS as readonly string[]).includes(v);
}

export function normalizeTaxCountry(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  if (s === "" || s === "OTHER") return null;
  if (!/^[A-Z]{2}$/.test(s)) return null;
  if (!EU_VAT_PREFIXES.has(s)) return null;
  return s;
}

export { isEuTaxCountry };

export function unitTypeLabel(unitType: string): string {
  switch (unitType) {
    case "headquarters":
      return "Centrála";
    case "branch":
      return "Pobočka";
    default:
      return "Samostatný";
  }
}
