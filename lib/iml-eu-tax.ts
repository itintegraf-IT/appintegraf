/**
 * EU VAT (DIČ) formáty a seznam zemí daně pro modul IML.
 * Fáze 1: lokální validace regex + délka; bez VIES.
 */

import type { CountryCode } from "libphonenumber-js";
import type { ValidationResult } from "@/lib/iml-validation";

export type EuTaxCountry = {
  code: string;
  label: string;
  /** Často používané – zobrazit v optgroup nahoře */
  frequent?: boolean;
};

/** 27 členských států EU – VAT prefix (Řecko = EL, ne GR) */
export const EU_TAX_COUNTRIES: EuTaxCountry[] = [
  { code: "AT", label: "AT – Rakousko", frequent: false },
  { code: "BE", label: "BE – Belgie", frequent: false },
  { code: "BG", label: "BG – Bulharsko", frequent: false },
  { code: "HR", label: "HR – Chorvatsko", frequent: false },
  { code: "CY", label: "CY – Kypr", frequent: false },
  { code: "CZ", label: "CZ – Česká republika", frequent: true },
  { code: "DK", label: "DK – Dánsko", frequent: false },
  { code: "EE", label: "EE – Estonsko", frequent: false },
  { code: "FI", label: "FI – Finsko", frequent: false },
  { code: "FR", label: "FR – Francie", frequent: false },
  { code: "DE", label: "DE – Německo", frequent: false },
  { code: "EL", label: "EL – Řecko (VAT prefix)", frequent: false },
  { code: "HU", label: "HU – Maďarsko", frequent: false },
  { code: "IE", label: "IE – Irsko", frequent: false },
  { code: "IT", label: "IT – Itálie", frequent: false },
  { code: "LV", label: "LV – Lotyšsko", frequent: false },
  { code: "LT", label: "LT – Litva", frequent: false },
  { code: "LU", label: "LU – Lucembursko", frequent: false },
  { code: "MT", label: "MT – Malta", frequent: false },
  { code: "NL", label: "NL – Nizozemsko", frequent: false },
  { code: "PL", label: "PL – Polsko", frequent: false },
  { code: "PT", label: "PT – Portugalsko", frequent: false },
  { code: "RO", label: "RO – Rumunsko", frequent: false },
  { code: "SK", label: "SK – Slovensko", frequent: true },
  { code: "SI", label: "SI – Slovinsko", frequent: false },
  { code: "ES", label: "ES – Španělsko", frequent: false },
  { code: "SE", label: "SE – Švédsko", frequent: false },
];

export const EU_VAT_PREFIXES = new Set(EU_TAX_COUNTRIES.map((c) => c.code));

/** Regex na celé DIČ včetně prefixu (po normalizaci: uppercase, bez mezer) */
const VAT_REGEX: Record<string, RegExp> = {
  AT: /^ATU\d{8}$/,
  BE: /^BE0\d{9}$/,
  BG: /^BG\d{9,10}$/,
  HR: /^HR\d{11}$/,
  CY: /^CY\d{8}[A-Z]$/,
  CZ: /^CZ\d{8,10}$/,
  DK: /^DK\d{8}$/,
  EE: /^EE\d{9}$/,
  FI: /^FI\d{8}$/,
  FR: /^FR[A-HJ-NP-Z0-9]{2}\d{9}$/,
  DE: /^DE\d{9}$/,
  EL: /^EL\d{9}$/,
  HU: /^HU\d{8}$/,
  IE: /^IE\d{7}[A-Z]{1,2}$/,
  IT: /^IT\d{11}$/,
  LV: /^LV\d{11}$/,
  LT: /^LT(\d{9}|\d{12})$/,
  LU: /^LU\d{8}$/,
  MT: /^MT\d{8}$/,
  NL: /^NL\d{9}B\d{2}$/,
  PL: /^PL\d{10}$/,
  PT: /^PT\d{9}$/,
  RO: /^RO\d{2,10}$/,
  SK: /^SK\d{10}$/,
  SI: /^SI\d{8}$/,
  ES: /^ES[A-Z0-9]{9}$/,
  SE: /^SE\d{12}$/,
};

/** Příklady DIČ pro placeholder */
const VAT_EXAMPLES: Record<string, string> = {
  AT: "ATU12345678",
  BE: "BE0123456789",
  BG: "BG123456789",
  HR: "HR12345678901",
  CY: "CY12345678L",
  CZ: "CZ12345678",
  DK: "DK12345678",
  EE: "EE123456789",
  FI: "FI12345678",
  FR: "FRXX123456789",
  DE: "DE123456789",
  EL: "EL123456789",
  HU: "HU12345678",
  IE: "IE1234567X",
  IT: "IT12345678901",
  LV: "LV12345678901",
  LT: "LT123456789",
  LU: "LU12345678",
  MT: "MT12345678",
  NL: "NL123456789B01",
  PL: "PL1234567890",
  PT: "PT123456789",
  RO: "RO123456789",
  SK: "SK1234567890",
  SI: "SI12345678",
  ES: "ESX1234567X",
  SE: "SE123456789012",
};

/** Národní IČ bez VAT prefixu (zjednodušeně) */
const REG_ID_REGEX: Record<string, RegExp> = {
  CZ: /^\d{7,8}$/,
  SK: /^\d{8,10}$/,
  DE: /^[A-Z0-9./-]{5,12}$/,
  AT: /^\d{6,9}$/,
  PL: /^\d{9,10}$/,
};

const DEFAULT_REG_ID = /^[A-Za-z0-9./-]{2,15}$/;

export function isEuTaxCountry(code: string | null | undefined): boolean {
  if (!code) return false;
  return EU_VAT_PREFIXES.has(code.toUpperCase());
}

export function vatPrefixToPhoneCountry(prefix: string | null | undefined): CountryCode {
  const p = (prefix ?? "CZ").toUpperCase();
  if (p === "EL") return "GR";
  if (EU_VAT_PREFIXES.has(p)) return p as CountryCode;
  return "CZ";
}

function emptyVat(): ValidationResult {
  return { ok: true, value: null };
}

function normalizeVatInput(raw: string): string {
  return raw.replace(/[\s./-]/g, "").toUpperCase();
}

/**
 * Validace DIČ (VAT) pro EU stát.
 * @param prefix VAT country code (CZ, EL, …)
 * @param raw uživatelský vstup (s nebo bez prefixu)
 */
export function validateEuVat(prefix: string, raw: unknown): ValidationResult {
  if (raw == null) return emptyVat();
  const s = String(raw).trim();
  if (s === "") return emptyVat();

  const code = prefix.toUpperCase();
  const regex = VAT_REGEX[code];
  if (!regex) {
    return {
      ok: false,
      value: null,
      error: `Neznámá země daně pro validaci DIČ: ${code}`,
    };
  }

  let compact = normalizeVatInput(s);
  if (!compact.startsWith(code)) {
    compact = `${code}${compact}`;
  }

  if (!regex.test(compact)) {
    const example = VAT_EXAMPLES[code] ?? `${code}…`;
    return {
      ok: false,
      value: null,
      error: `Neplatný formát DIČ pro ${code} (očekáváno např. ${example})`,
    };
  }

  return { ok: true, value: compact };
}

/**
 * Validace národního identifikačního čísla (bez VAT prefixu).
 * Pro CZ použijte validateIco z iml-validation.ts (kontrolní součet).
 */
export function validateEuRegistrationId(prefix: string, raw: unknown): ValidationResult {
  if (raw == null) return emptyVat();
  const s = String(raw).trim();
  if (s === "") return emptyVat();

  const code = prefix.toUpperCase();
  const compact = s.replace(/\s+/g, "");
  const regex = REG_ID_REGEX[code] ?? DEFAULT_REG_ID;

  if (!regex.test(compact)) {
    if (code === "CZ") {
      return {
        ok: false,
        value: null,
        error: "IČO musí mít 7–8 číslic (kontrolní součet při uložení)",
      };
    }
    if (code === "SK") {
      return {
        ok: false,
        value: null,
        error: "IČ musí mít 8–10 číslic",
      };
    }
    return {
      ok: false,
      value: null,
      error: "Identifikační číslo: 2–15 znaků (písmena, číslice, . / -)",
    };
  }

  return { ok: true, value: compact.replace(/[^\dA-Za-z./-]/g, "").toUpperCase() };
}

export function getTaxFieldHints(prefix: string): {
  icoHint: string;
  dicHint: string;
  dicPlaceholder: string;
} {
  const code = (prefix === "OTHER" ? "CZ" : prefix).toUpperCase();
  if (code === "CZ") {
    return {
      icoHint: "8 číslic, kontrolní součet dle ARES",
      dicHint: "Formát CZ + 8–10 číslic",
      dicPlaceholder: VAT_EXAMPLES.CZ ?? "CZ12345678",
    };
  }
  if (code === "SK") {
    return {
      icoHint: "8–10 číslic",
      dicHint: "Formát SK + 10 číslic",
      dicPlaceholder: VAT_EXAMPLES.SK ?? "SK1234567890",
    };
  }
  if (isEuTaxCountry(code)) {
    return {
      icoHint: "Národní identifikační číslo firmy (bez VAT prefixu)",
      dicHint: `Formát DIČ dle ${code} (VAT prefix + národní část)`,
      dicPlaceholder: VAT_EXAMPLES[code] ?? `${code}…`,
    };
  }
  return {
    icoHint: "2–32 znaků (písmena, číslice, . / -)",
    dicHint: "2–32 znaků (písmena a číslice)",
    dicPlaceholder: "DIČ / VAT",
  };
}

export function getFrequentEuCountries(): EuTaxCountry[] {
  return EU_TAX_COUNTRIES.filter((c) => c.frequent);
}

export function getOtherEuCountries(): EuTaxCountry[] {
  return EU_TAX_COUNTRIES.filter((c) => !c.frequent).sort((a, b) =>
    a.label.localeCompare(b.label, "cs")
  );
}
