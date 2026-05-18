import { redirect } from "next/navigation";

/** Sjednocené texty chyb pro query param `error` v redirect URL. */
export const NAV_ERRORS = {
  NO_PERMISSION: "Nemáte oprávnění",
  NO_MODULE_ACCESS: "Nemáte přístup k tomuto modulu",
  NO_PERSONALISTIKA: "Nemáte přístup k modulu Personalistika",
} as const;

export type NavErrorCode = keyof typeof NAV_ERRORS;

/**
 * Sestaví cestu s `error` query parametrem (URL-encoded kvůli HTTP hlavičce Location).
 */
export function pathWithError(pathname: string, code: NavErrorCode): string {
  const message = NAV_ERRORS[code];
  const sep = pathname.includes("?") ? "&" : "?";
  return `${pathname}${sep}error=${encodeURIComponent(message)}`;
}

/** Přesměrování s kódovanou chybovou hláškou (bezpečné pro Node.js Location header). */
export function redirectWithError(pathname: string, code: NavErrorCode): never {
  redirect(pathWithError(pathname, code));
}

/** Běžný redirect při chybějícím admin oprávnění. */
export function redirectAdminDenied(): never {
  redirectWithError("/contacts", "NO_PERMISSION");
}

/** Dekódování `error` z URL (server i client). */
export function decodeNavError(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
