/**
 * Replace semantika pro iml_product_colors – sdílená logika pro:
 *   - PUT /api/iml/products/[id]/colors (dedikovaný endpoint)
 *   - POST /api/iml/products (vytvoření produktu spolu s barvami)
 *   - PUT  /api/iml/products/[id] (uložení formuláře včetně barev)
 *
 * Musí běžet v rámci Prisma transakce, aby se nemohlo stát, že se smažou
 * stávající vazby a nové se nevloží.
 */

import type { Prisma } from "@prisma/client";
import { isValidPantoneCode, normalizePantoneCode } from "./iml-pantone";

export type IncomingProductColor = {
  pantone_id?: number | null;
  code?: string | null;
  coverage_pct: number;
  sort_order?: number | null;
};

export type ReplaceResult =
  | {
      ok: true;
      colors: Array<{
        id: number;
        pantone_id: number;
        coverage_pct: Prisma.Decimal;
        sort_order: number;
      }>;
    }
  | {
      ok: false;
      status: 400 | 422;
      error: string;
      missing_codes?: string[];
      details?: Array<{ index: number; error: string; field?: string }>;
    };

/**
 * Ověří vstupy (coverage 0–100, kód přes Pantone normalizaci).
 * Vrací buď chybu, nebo připravené řádky k zápisu.
 */
export function validateProductColorsInput(
  incoming: IncomingProductColor[]
):
  | {
      ok: true;
      prepared: Array<{
        pantone_id: number | null;
        code: string | null;
        coverage_pct: number;
        sort_order: number;
      }>;
    }
  | { ok: false; details: Array<{ index: number; error: string; field?: string }> } {
  const prepared: Array<{
    pantone_id: number | null;
    code: string | null;
    coverage_pct: number;
    sort_order: number;
  }> = [];
  const invalid: Array<{ index: number; error: string; field?: string }> = [];

  for (let i = 0; i < incoming.length; i++) {
    const row = incoming[i];
    const coverage = Number(row.coverage_pct);
    if (!Number.isFinite(coverage) || coverage < 0 || coverage > 100) {
      invalid.push({ index: i, error: "Pokrytí musí být 0–100", field: "coverage_pct" });
      continue;
    }
    const pantoneId = row.pantone_id != null ? Number(row.pantone_id) : null;
    let code: string | null = null;
    if (!pantoneId) {
      const codeNorm = normalizePantoneCode(typeof row.code === "string" ? row.code : "");
      if (!isValidPantoneCode(codeNorm)) {
        invalid.push({ index: i, error: "Neplatný Pantone kód", field: "code" });
        continue;
      }
      code = codeNorm;
    }
    prepared.push({
      pantone_id: pantoneId,
      code,
      coverage_pct: Math.round(coverage * 100) / 100,
      sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : i,
    });
  }

  if (invalid.length > 0) return { ok: false, details: invalid };
  return { ok: true, prepared };
}

/**
 * Replace semantika v transakci: smaže existující vazby pro produkt a vloží nové.
 * Předpokládá, že vstup už byl validován přes validateProductColorsInput.
 *
 * Pokud v `prepared` narazí na neznámý kód (bez pantone_id) a !autoCreate,
 * vrátí { ok: false, status: 422, missing_codes }.
 *
 * Duplicitní pantone_id v rámci jednoho produktu se tiše zahazují (dedupe) –
 * UI by to mělo hlídat už předem.
 */
export async function replaceProductColorsInTx(
  tx: Prisma.TransactionClient,
  productId: number,
  prepared: Array<{
    pantone_id: number | null;
    code: string | null;
    coverage_pct: number;
    sort_order: number;
  }>,
  autoCreate: boolean
): Promise<ReplaceResult> {
  const neededCodes = Array.from(
    new Set(prepared.filter((r) => r.pantone_id == null && r.code).map((r) => r.code!))
  );

  const existing = neededCodes.length
    ? await tx.iml_pantone_colors.findMany({
        where: { code: { in: neededCodes } },
        select: { id: true, code: true },
      })
    : [];

  const codeToId = new Map<string, number>(existing.map((c) => [c.code, c.id]));
  const missingCodes = neededCodes.filter((c) => !codeToId.has(c));

  if (missingCodes.length > 0 && !autoCreate) {
    return {
      ok: false,
      status: 422,
      error: "Některé Pantone kódy nejsou v číselníku",
      missing_codes: missingCodes,
    };
  }

  for (const code of missingCodes) {
    const created = await tx.iml_pantone_colors.create({
      data: { code, is_active: true },
    });
    codeToId.set(code, created.id);
  }

  await tx.iml_product_colors.deleteMany({ where: { product_id: productId } });

  const seen = new Set<number>();
  const rows: Array<{
    product_id: number;
    pantone_id: number;
    coverage_pct: number;
    sort_order: number;
  }> = [];
  for (const r of prepared) {
    const pid = r.pantone_id ?? (r.code ? codeToId.get(r.code) ?? null : null);
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    rows.push({
      product_id: productId,
      pantone_id: pid,
      coverage_pct: r.coverage_pct,
      sort_order: r.sort_order,
    });
  }
  if (rows.length > 0) {
    await tx.iml_product_colors.createMany({ data: rows });
  }

  const colors = await tx.iml_product_colors.findMany({
    where: { product_id: productId },
    select: { id: true, pantone_id: true, coverage_pct: true, sort_order: true },
    orderBy: [{ sort_order: "asc" }, { id: "asc" }],
  });

  return { ok: true, colors };
}
