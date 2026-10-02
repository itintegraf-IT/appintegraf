/**
 * Požadavky terénních obrazovek (sken, inventura, přesun). Telefon v hale bývá
 * „připojený“, ale data neprotékají — běžný fetch by pak visel minuty a obrazovka
 * by tiše ignorovala další skeny. Bez odpovědi do limitu se požadavek zruší.
 * Bez importů (smí do klientských komponent).
 */

export const FIELD_FETCH_TIMEOUT_MS = 12000;

export const FIELD_TIMEOUT_MESSAGE =
  "Server neodpovídá. Změna se možná uložila — zkontrolujte stav a případně akci zopakujte.";
export const FIELD_NETWORK_MESSAGE = "Spojení se serverem selhalo. Změna se nemusela uložit — zkuste to znovu.";

export class FieldFetchTimeoutError extends Error {
  constructor() {
    super("Server neodpovídá.");
    this.name = "FieldFetchTimeoutError";
  }
}

export async function fieldFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = FIELD_FETCH_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) throw new FieldFetchTimeoutError();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Text chyby pro uživatele podle toho, zda server neodpověděl, nebo spojení selhalo. */
export function fieldFetchErrorMessage(e: unknown): string {
  return e instanceof FieldFetchTimeoutError ? FIELD_TIMEOUT_MESSAGE : FIELD_NETWORK_MESSAGE;
}
