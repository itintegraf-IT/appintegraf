/** Minimální pole produktu pro vyhledávání v pickeru. */
export type ImlSearchableProduct = {
  id: number;
  ig_code?: string | null;
  ig_short_name?: string | null;
  client_code?: string | null;
  client_name?: string | null;
};

function codeStartsWith(code: string | null | undefined, q: string): boolean {
  return (code?.toLowerCase().startsWith(q) ?? false);
}

function matchesQuery(p: ImlSearchableProduct, q: string): boolean {
  return (
    (p.ig_code?.toLowerCase().includes(q) ?? false) ||
    (p.client_code?.toLowerCase().includes(q) ?? false) ||
    (p.ig_short_name?.toLowerCase().includes(q) ?? false) ||
    (p.client_name?.toLowerCase().includes(q) ?? false)
  );
}

function matchRank(p: ImlSearchableProduct, q: string): number {
  if (codeStartsWith(p.ig_code, q) || codeStartsWith(p.client_code, q)) return 0;
  if (matchesQuery(p, q)) return 1;
  return 2;
}

/** Filtruje produkty podle dotazu; prázdný dotaz vrátí celý seznam. */
export function filterProductsByQuery<T extends ImlSearchableProduct>(
  products: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products
    .filter((p) => matchesQuery(p, q))
    .sort((a, b) => matchRank(a, q) - matchRank(b, q));
}

export function formatProductLabel(p: ImlSearchableProduct): string {
  const code = p.ig_code ?? `#${p.id}`;
  const name = p.client_name ?? p.ig_short_name ?? "Bez názvu";
  return `${code} — ${name}`;
}
