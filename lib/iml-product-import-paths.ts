/** Odstraní společný kořen složky (např. IMLEXport/…) z cest z prohlížeče. */
export function normalizeFolderPathPrefixes(paths: string[]): string[] {
  if (paths.length === 0) return paths;
  const normalized = paths.map((p) => p.replace(/\\/g, "/"));
  const firstSeg = normalized[0]?.split("/")[0];
  if (!firstSeg) return normalized;
  const allShareRoot = normalized.every(
    (p) => p === firstSeg || p.startsWith(`${firstSeg}/`)
  );
  if (!allShareRoot || !normalized.some((p) => p.includes("/"))) {
    return normalized;
  }
  return normalized.map((p) => {
    if (p === firstSeg) return p;
    if (p.startsWith(`${firstSeg}/`)) return p.slice(firstSeg.length + 1);
    return p;
  });
}
