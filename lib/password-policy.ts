/**
 * Centralizovaná pravidla pro heslo. Používá se na:
 *  - formuláři profilu (změna hesla),
 *  - stránce /reset-password,
 *  - stránce /activate,
 *  - admin formuláři pro ruční zadání hesla.
 */

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordValidation = {
  ok: boolean;
  /** Lokalizovaný text první chyby, pokud ok=false. */
  error?: string;
  /** Skóre 0–4 pro vizuální indikátor síly. */
  score: number;
};

export function validatePassword(password: string): PasswordValidation {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      error: `Heslo musí mít alespoň ${PASSWORD_MIN_LENGTH} znaků.`,
      score: 0,
    };
  }

  const hasLetter = /[A-Za-zÁ-ž]/.test(password);
  const hasDigit = /\d/.test(password);
  if (!hasLetter || !hasDigit) {
    return {
      ok: false,
      error: "Heslo musí obsahovat alespoň jedno písmeno a jednu číslici.",
      score: 1,
    };
  }

  let score = 2;
  if (password.length >= 12) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score > 4) score = 4;

  return { ok: true, score };
}

export const PASSWORD_RULES_TEXT = `Min. ${PASSWORD_MIN_LENGTH} znaků, alespoň 1 písmeno a 1 číslice. Doporučeno: 12+ znaků se speciálním znakem.`;
