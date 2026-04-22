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
 * Telefon – akceptujeme:
 *   - mezinárodní předvolbu +420 / +421 + 9 číslic
 *   - bez předvolby 9 číslic (dopíše se +420)
 *   - mezery, pomlčky a závorky ignorujeme
 * Normalizace: "+420 XXX XXX XXX"
 */
export function validateCzPhone(raw: unknown): ValidationResult {
  if (raw == null) return emptyResult();
  const s = String(raw).trim();
  if (s === "") return emptyResult();

  const cleaned = s.replace(/[\s\-().]/g, "");
  let country = "+420";
  let digits = cleaned;

  if (cleaned.startsWith("+")) {
    const match = cleaned.match(/^\+(420|421)(\d+)$/);
    if (!match) {
      return {
        ok: false,
        value: null,
        error: "Podporujeme pouze předvolby +420 (CZ) a +421 (SK)",
      };
    }
    country = `+${match[1]}`;
    digits = match[2];
  } else if (cleaned.startsWith("00")) {
    const match = cleaned.match(/^00(420|421)(\d+)$/);
    if (!match) {
      return {
        ok: false,
        value: null,
        error: "Podporujeme pouze předvolby 00420 / 00421",
      };
    }
    country = `+${match[1]}`;
    digits = match[2];
  } else if (!/^\d+$/.test(cleaned)) {
    return { ok: false, value: null, error: "Telefon smí obsahovat jen číslice a předvolbu" };
  }

  if (digits.length !== 9) {
    return {
      ok: false,
      value: null,
      error: "Telefon musí mít 9 číslic (např. +420 602 123 456)",
    };
  }

  const formatted = `${country} ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
  return { ok: true, value: formatted };
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
