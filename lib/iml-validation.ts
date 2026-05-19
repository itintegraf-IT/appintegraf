import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Validátory vstupních polí pro IML modul (zákazník, dodavatel, ...).
 *
 * Všechny funkce jsou čisté (bez DOM/DB) a vrací stejný tvar:
 *   { ok: boolean, value: string | null, error?: string }
 *
 * Pokud je vstup prázdný (null/undefined/"" po trimu), validátor vrací
 * { ok: true, value: null } – prázdné pole je povolené. Volajícímu
 * přísluší rozhodnout, zda pole označí jako povinné.
 */

export type ValidationResult = {
  ok: boolean;
  value: string | null;
  error?: string;
};

function emptyResult(): ValidationResult {
  return { ok: true, value: null };
}

/**
 * E-mail – zjednodušená varianta RFC 5322:
 *   - local část bez mezer a bez "@"
 *   - doména bez mezer a "@"
 *   - TLD ≥ 2 znaky (písmena)
 */
export function validateEmail(raw: unknown): ValidationResult {
  if (raw == null) return emptyResult();
  const s = String(raw).trim();
  if (s === "") return emptyResult();

  const re = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  if (!re.test(s)) {
    return { ok: false, value: null, error: "Neplatný formát e-mailu (očekáváno např. jmeno@domena.cz)" };
  }
  const atIdx = s.lastIndexOf("@");
  const local = s.slice(0, atIdx);
  const domain = s.slice(atIdx + 1).toLowerCase();
  return { ok: true, value: `${local}@${domain}` };
}

/**
 * Mezinárodní telefon (libphonenumber-js).
 * Bez předvolby použije defaultCountry (výchozí CZ).
 */
export function validateInternationalPhone(
  raw: unknown,
  defaultCountry: CountryCode = "CZ"
): ValidationResult {
  if (raw == null) return emptyResult();
  const s = String(raw).trim();
  if (s === "") return emptyResult();

  const parsed = parsePhoneNumberFromString(s, defaultCountry);
  if (!parsed || !parsed.isValid()) {
    return {
      ok: false,
      value: null,
      error: "Neplatné telefonní číslo (uveďte předvolbu, např. +420 602 123 456)",
    };
  }
  return { ok: true, value: parsed.formatInternational() };
}

/** @deprecated Preferujte validateInternationalPhone */
export function validateCzPhone(raw: unknown): ValidationResult {
  return validateInternationalPhone(raw, "CZ");
}

function validateForeignRegistrationId(raw: unknown): ValidationResult {
  if (raw == null) return emptyResult();
  const s = String(raw).trim();
  if (s === "") return emptyResult();
  const compact = s.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9./-]{2,32}$/.test(compact)) {
    return {
      ok: false,
      value: null,
      error: "Identifikační číslo firmy: 2–32 znaků (písmena, číslice, . / -)",
    };
  }
  return { ok: true, value: compact.toUpperCase() };
}

function validateForeignTaxId(raw: unknown): ValidationResult {
  if (raw == null) return emptyResult();
  const s = String(raw).trim();
  if (s === "") return emptyResult();
  const compact = s.replace(/[\s/-]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{2,32}$/.test(compact)) {
    return {
      ok: false,
      value: null,
      error: "Daňové identifikační číslo: 2–32 znaků (písmena a číslice)",
    };
  }
  return { ok: true, value: compact };
}

/**
 * IČO / DIČ podle země (CZ/SK = stávající algoritmy, jinak volnější formát).
 */
export function validateTaxIds(
  taxCountry: string | null | undefined,
  icoRaw: unknown,
  dicRaw: unknown
): { ico: ValidationResult; dic: ValidationResult } {
  const country = (taxCountry ?? "CZ").toUpperCase();
  if (country === "CZ") {
    return { ico: validateIco(icoRaw), dic: validateDic(dicRaw) };
  }
  if (country === "SK") {
    const ico = validateForeignRegistrationId(icoRaw);
    const dic = validateDic(dicRaw);
    return { ico, dic };
  }
  return {
    ico: validateForeignRegistrationId(icoRaw),
    dic: validateForeignTaxId(dicRaw),
  };
}

/**
 * IČO (ČR) – 8 číslic, kontrolní součet dle ARES (modulo 11).
 * Povolujeme zadat 7 číslic (doplní se leading zero) – u starších firem.
 * Algoritmus:
 *   váhy = [8,7,6,5,4,3,2]
 *   součet = Σ d[i] * váha[i]   (i = 0..6)
 *   kontrolní = (11 - součet % 11) % 10
 *   očekává se, že kontrolní === d[7]
 */
export function validateIco(raw: unknown): ValidationResult {
  if (raw == null) return emptyResult();
  const s = String(raw).trim();
  if (s === "") return emptyResult();

  const digits = s.replace(/\s+/g, "");
  if (!/^\d+$/.test(digits)) {
    return { ok: false, value: null, error: "IČO smí obsahovat pouze číslice" };
  }

  const padded = digits.length === 7 ? `0${digits}` : digits;
  if (padded.length !== 8) {
    return { ok: false, value: null, error: "IČO musí mít 8 číslic" };
  }

  const weights = [8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += parseInt(padded[i], 10) * weights[i];
  }
  const expected = (11 - (sum % 11)) % 10;
  const actual = parseInt(padded[7], 10);

  if (expected !== actual) {
    return { ok: false, value: null, error: "Neplatné IČO (špatný kontrolní součet)" };
  }

  return { ok: true, value: padded };
}

/**
 * DIČ (ČR/SK) – prefix země + 8–10 číslic.
 *   - CZ: 8, 9 nebo 10 číslic (právnická / fyzická osoba)
 *   - SK: 9 nebo 10 číslic
 * Mezery a lomítka ignorujeme, prefix uppercase.
 */
export function validateDic(raw: unknown): ValidationResult {
  if (raw == null) return emptyResult();
  const s = String(raw).trim();
  if (s === "") return emptyResult();

  const cleaned = s.replace(/[\s/-]/g, "").toUpperCase();
  const match = cleaned.match(/^(CZ|SK)(\d{8,10})$/);
  if (!match) {
    return {
      ok: false,
      value: null,
      error: "DIČ musí začínat CZ nebo SK a obsahovat 8–10 číslic (např. CZ12345678)",
    };
  }

  const [, country, digits] = match;
  if (country === "SK" && digits.length < 9) {
    return {
      ok: false,
      value: null,
      error: "DIČ SK musí mít 9 nebo 10 číslic",
    };
  }

  return { ok: true, value: `${country}${digits}` };
}
