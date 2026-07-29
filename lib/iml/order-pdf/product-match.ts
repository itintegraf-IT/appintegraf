/** Index produktů podle kódu klienta a kódu IG pro import objednávek z PDF. */

export type ProductCodeRow = {
  id: number;
  ig_code: string | null;
  client_code: string | null;
  client_name: string | null;
  ig_short_name: string | null;
  customer_id: number | null;
};

export type ProductMatchResult = {
  product: ProductCodeRow | null;
  matchedBy: "client_code" | "ig_code" | null;
  matchedCode: string | null;
};

/** Normalizace kódu pro porovnání (bez mezer, lowercase). */
export function normalizeProductCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

export function buildProductCodeIndexes(products: ProductCodeRow[]): {
  byClientCode: Map<string, ProductCodeRow>;
  byIgCode: Map<string, ProductCodeRow>;
} {
  const byClientCode = new Map<string, ProductCodeRow>();
  const byIgCode = new Map<string, ProductCodeRow>();

  for (const p of products) {
    if (p.client_code) {
      byClientCode.set(normalizeProductCode(p.client_code), p);
    }
    if (p.ig_code) {
      byIgCode.set(normalizeProductCode(p.ig_code), p);
    }
  }

  return { byClientCode, byIgCode };
}

/**
 * Najde produkt podle kódů z PDF. Každý kód zkouší v client_code i ig_code –
 * v databázi bývají čísla zákazníka i Integraf uložená v obou polích.
 */
export function matchProductByCodes(
  indexes: { byClientCode: Map<string, ProductCodeRow>; byIgCode: Map<string, ProductCodeRow> },
  codes: (string | null | undefined)[]
): ProductMatchResult {
  for (const raw of codes) {
    if (!raw?.trim()) continue;
    const key = normalizeProductCode(raw);

    const byClient = indexes.byClientCode.get(key);
    if (byClient) {
      return { product: byClient, matchedBy: "client_code", matchedCode: raw.trim() };
    }

    const byIg = indexes.byIgCode.get(key);
    if (byIg) {
      return { product: byIg, matchedBy: "ig_code", matchedCode: raw.trim() };
    }
  }

  return { product: null, matchedBy: null, matchedCode: null };
}

export function productLabel(p: ProductCodeRow): string {
  return `${p.ig_code ?? `#${p.id}`} — ${p.client_name ?? p.ig_short_name ?? "Bez názvu"}`;
}
