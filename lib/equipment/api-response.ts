/**
 * Čtení odpovědi API modulu v prohlížeči. Po vypršení přihlášení proxy přesměruje
 * i volání API na /login — fetch pak dostane HTML stránku s kódem 200, kterou
 * nesmíme vzít jako úspěch. Bez importů (smí do klientských komponent).
 */

export const SESSION_EXPIRED_MESSAGE =
  "Přihlášení vypršelo. Přihlaste se znovu v nové kartě a akci zopakujte — vyplněné údaje tady zůstanou.";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; sessionExpired: boolean; error: string; field?: string };

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

export async function readApiResponse<T>(res: Response, fallbackError: string): Promise<ApiResult<T>> {
  const expired = { ok: false as const, sessionExpired: true, error: SESSION_EXPIRED_MESSAGE };
  if (res.redirected && pathOf(res.url) === "/login") return expired;
  if (res.status === 401) return expired;

  const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
  if (!isJson) {
    return res.ok ? expired : { ok: false, sessionExpired: false, error: fallbackError };
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const { error: message, field } = (data ?? {}) as { error?: unknown; field?: unknown };
    return {
      ok: false,
      sessionExpired: false,
      error: typeof message === "string" && message ? message : fallbackError,
      ...(typeof field === "string" ? { field } : {}),
    };
  }
  return { ok: true, data: data as T };
}

export type PdfResult =
  | { ok: true; blob: Blob; headers: Headers }
  | { ok: false; sessionExpired: boolean; error: string };

/** Čtení odpovědi, která má být PDF (tisk štítků); chyby a vypršelé přihlášení jako u readApiResponse. */
export async function readPdfResponse(res: Response, fallbackError: string): Promise<PdfResult> {
  const contentType = res.headers.get("content-type") ?? "";
  if (res.ok && contentType.includes("application/pdf") && !(res.redirected && pathOf(res.url) === "/login")) {
    return { ok: true, blob: await res.blob(), headers: res.headers };
  }
  const result = await readApiResponse<unknown>(res, fallbackError);
  if (result.ok) return { ok: false, sessionExpired: false, error: fallbackError };
  return { ok: false, sessionExpired: result.sessionExpired, error: result.error };
}
