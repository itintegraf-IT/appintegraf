import { prisma } from "@/lib/db";
import { normalizeProductCode } from "@/lib/iml-product-import-parse";

export type MaketyImlProductConflict = {
  product_id: number;
  ig_code: string | null;
  client_name: string | null;
  ig_short_name: string | null;
  customer_id: number | null;
};

export type ImlProductIgMatch = {
  id: number;
  ig_code: string | null;
  client_code: string | null;
  client_name: string | null;
  ig_short_name: string | null;
  production_notes: string | null;
  customer_id: number | null;
  die_cut_id: number | null;
  shape_id: number | null;
};

/** Porovná dva kódy IG (normalizace trim + uppercase). */
export function matchProductByIgCode(
  productIgCode: string | null | undefined,
  searchIgCode: string
): boolean {
  const normalized = normalizeProductCode(searchIgCode);
  if (!normalized) return false;
  if (!productIgCode?.trim()) return false;
  return normalizeProductCode(productIgCode) === normalized;
}

export function toMaketyImlProductConflict(
  product: ImlProductIgMatch
): MaketyImlProductConflict {
  return {
    product_id: product.id,
    ig_code: product.ig_code,
    client_name: product.client_name,
    ig_short_name: product.ig_short_name,
    customer_id: product.customer_id,
  };
}

const productSelectForLookup = {
  id: true,
  ig_code: true,
  client_code: true,
  client_name: true,
  ig_short_name: true,
  production_notes: true,
  customer_id: true,
  die_cut_id: true,
  shape_id: true,
} as const;

export type FindImlProductByIgCodeOptions = {
  /** Při update/importu přeskočí produkt s tímto id. */
  excludeId?: number;
};

export async function findImlProductByIgCode(
  igCode: string,
  options?: FindImlProductByIgCodeOptions
): Promise<ImlProductIgMatch | null> {
  const normalized = normalizeProductCode(igCode);
  if (!normalized) return null;

  const excludeId = options?.excludeId;
  const notSelf = excludeId != null ? { NOT: { id: excludeId } } : {};

  const exact = await prisma.iml_products.findFirst({
    where: { ig_code: igCode.trim(), ...notSelf },
    select: productSelectForLookup,
  });
  if (exact && matchProductByIgCode(exact.ig_code, igCode)) {
    return exact;
  }

  const candidates = await prisma.iml_products.findMany({
    where: { ig_code: { not: null }, ...notSelf },
    select: productSelectForLookup,
    take: 5000,
  });

  return candidates.find((p) => matchProductByIgCode(p.ig_code, igCode)) ?? null;
}

/**
 * Vrátí konfliktní produkt, pokud je `igCode` neprázdný a už existuje
 * (normalizace trim + uppercase). Jinak null.
 */
export async function findConflictingProductByIgCode(
  igCode: string | null | undefined,
  excludeId?: number
): Promise<ImlProductIgMatch | null> {
  if (!igCode?.trim()) return null;
  return findImlProductByIgCode(igCode, { excludeId });
}
