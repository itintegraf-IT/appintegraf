import { prisma } from "@/lib/db";

export type PackagingRow = {
  id: number;
  material_code: string;
  weight_per_thousand: number;
  pcs_per_box: number;
  pcs_per_pallet: number;
  box_type: string | null;
};

/** Normalizace kódu materiálu pro párování (EUP60 ≈ EUP 60 ≈ eup60). */
export function normalizeMaterialCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "")
    .replace(/G\/M2|GSM/g, "");
}

/**
 * Najde řádek matice pro materiál produktu (podle code fólie / papíru).
 * Preferuje foil_material, pak paper.
 */
export async function findPackagingForProductMaterial(params: {
  shapeId: number;
  foilMaterialId?: number | null;
  paperMaterialId?: number | null;
}): Promise<PackagingRow | null> {
  const packaging = await prisma.iml_shape_material_packaging.findMany({
    where: { shape_id: params.shapeId },
  });
  if (packaging.length === 0) return null;

  const materialIds = [params.foilMaterialId, params.paperMaterialId].filter(
    (x): x is number => x != null && Number.isFinite(x)
  );
  if (materialIds.length === 0) return null;

  const materials = await prisma.materials.findMany({
    where: { id: { in: materialIds } },
    select: { id: true, code: true, name: true },
  });

  const codes = materials
    .flatMap((m) => [m.code, m.name].filter(Boolean) as string[])
    .map(normalizeMaterialCode);

  for (const row of packaging) {
    const rowNorm = normalizeMaterialCode(row.material_code);
    if (codes.some((c) => c === rowNorm || c.includes(rowNorm) || rowNorm.includes(c))) {
      return {
        id: row.id,
        material_code: row.material_code,
        weight_per_thousand: Number(row.weight_per_thousand),
        pcs_per_box: row.pcs_per_box,
        pcs_per_pallet: row.pcs_per_pallet,
        box_type: row.box_type,
      };
    }
  }
  return null;
}

export async function listShapePackaging(shapeId: number): Promise<PackagingRow[]> {
  const rows = await prisma.iml_shape_material_packaging.findMany({
    where: { shape_id: shapeId },
    orderBy: { material_code: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    material_code: r.material_code,
    weight_per_thousand: Number(r.weight_per_thousand),
    pcs_per_box: r.pcs_per_box,
    pcs_per_pallet: r.pcs_per_pallet,
    box_type: r.box_type,
  }));
}

/** Sync balicích polí produktu z aktivního řádku matice (pokud se najde). */
export async function packingFieldsFromShapeMaterial(params: {
  shapeId: number;
  foilMaterialId?: number | null;
  paperMaterialId?: number | null;
}): Promise<{
  pieces_per_box?: number;
  pieces_per_pallet?: number;
  pallet_weight?: number | null;
}> {
  const match = await findPackagingForProductMaterial(params);
  if (!match) return {};
  const out: {
    pieces_per_box?: number;
    pieces_per_pallet?: number;
    pallet_weight?: number | null;
  } = {};
  if (match.pcs_per_box > 0) out.pieces_per_box = match.pcs_per_box;
  if (match.pcs_per_pallet > 0) out.pieces_per_pallet = match.pcs_per_pallet;
  if (match.weight_per_thousand > 0 && match.pcs_per_pallet > 0) {
    // g/1000 ks → kg na paletu
    out.pallet_weight =
      Math.round(((match.weight_per_thousand * match.pcs_per_pallet) / 1000 / 1000) * 100) /
      100;
  }
  return out;
}
