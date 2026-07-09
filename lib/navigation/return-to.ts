export const RETURN_TO_PARAM = "returnTo";

/** Bezpečná interní cesta (bez open redirect). */
export function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("://")) return false;
  return true;
}

export function resolveBackHref(returnToParam: string | null | undefined, fallback: string): string {
  if (!returnToParam) return fallback;
  try {
    const decoded = decodeURIComponent(returnToParam);
    if (isSafeInternalPath(decoded)) return decoded;
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Přidá returnTo query param k cílové URL. */
export function withReturnTo(href: string, returnTo: string): string {
  if (!returnTo || !isSafeInternalPath(returnTo)) return href;
  const [pathAndQuery, hash = ""] = href.split("#");
  const qIndex = pathAndQuery.indexOf("?");
  const pathname = qIndex >= 0 ? pathAndQuery.slice(0, qIndex) : pathAndQuery;
  const params = new URLSearchParams(qIndex >= 0 ? pathAndQuery.slice(qIndex + 1) : "");
  params.set(RETURN_TO_PARAM, returnTo);
  const query = params.toString();
  const built = query ? `${pathname}?${query}` : pathname;
  return hash ? `${built}#${hash}` : built;
}

/** Zachová returnTo z aktuální URL při navigaci na jinou stránku. */
export function preserveReturnTo(
  href: string,
  returnToParam: string | null | undefined
): string {
  if (!returnToParam) return href;
  return withReturnTo(href, resolveBackHref(returnToParam, href));
}
