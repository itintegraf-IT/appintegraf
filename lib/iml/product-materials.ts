import { prisma } from "@/lib/db";
import type { MaterialCategoryCode } from "@/lib/materialy/categories";
import { normalizeCategoryCode } from "@/lib/materialy/categories";

const FK_BY_CATEGORY: Record<
  MaterialCategoryCode,
  "foil_material_id" | "color_material_id" | "paper_material_id" | "lacquer_material_id"
> = {
  FOIL: "foil_material_id",
  COLOR: "color_material_id",
  PAPER: "paper_material_id",
  LACQUER: "lacquer_material_id",
};

export function materialIdFieldForCategory(category: MaterialCategoryCode) {
  return FK_BY_CATEGORY[category];
}

export async function resolveMaterialFk(
  materialId: number | null | undefined,
  expectedCategory: MaterialCategoryCode
): Promise<number | null> {
  if (materialId == null) return null;
  const row = await prisma.materials.findUnique({
    where: { id: materialId },
    select: { id: true, category_code: true, is_active: true },
  });
  if (!row || !row.is_active) {
    throw new Error(`Materiál #${materialId} neexistuje nebo není aktivní`);
  }
  if (row.category_code !== expectedCategory) {
    throw new Error(`Materiál #${materialId} není kategorie ${expectedCategory}`);
  }
  return row.id;
}

export async function materialDisplayLabel(materialId: number | null): Promise<string | null> {
  if (materialId == null) return null;
  const row = await prisma.materials.findUnique({
    where: { id: materialId },
    select: { name: true, code: true },
  });
  if (!row) return null;
  return row.code ? `${row.name} (${row.code})` : row.name;
}

/** Doplní FK a synchronizuje textová pole pro export / zpětnou kompatibilitu */
export async function enrichProductMaterialFields(body: Record<string, unknown>) {
  const int = (v: unknown) => {
    if (v == null || v === "") return null;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: unknown) => (v != null && v !== "" ? String(v).trim() : null);

  const foilRaw = int(body.foil_material_id);
  const colorRaw = int(body.color_material_id);
  const paperRaw = int(body.paper_material_id);
  const lacquerRaw = int(body.lacquer_material_id);

  let foilMaterialId: number | null = null;
  let colorMaterialId: number | null = null;
  let paperMaterialId: number | null = null;
  let lacquerMaterialId: number | null = null;

  try {
    if (foilRaw != null) foilMaterialId = await resolveMaterialFk(foilRaw, "FOIL");
    if (colorRaw != null) colorMaterialId = await resolveMaterialFk(colorRaw, "COLOR");
    if (paperRaw != null) paperMaterialId = await resolveMaterialFk(paperRaw, "PAPER");
    if (lacquerRaw != null) lacquerMaterialId = await resolveMaterialFk(lacquerRaw, "LACQUER");
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Neplatný materiál z katalogu");
  }

  let foil_type = str(body.foil_type);
  let color_coverage = str(body.color_coverage);

  if (foilMaterialId) {
    foil_type = (await materialDisplayLabel(foilMaterialId)) ?? foil_type;
  }
  if (colorMaterialId) {
    color_coverage = (await materialDisplayLabel(colorMaterialId)) ?? color_coverage;
  }

  return {
    foil_material_id: foilMaterialId,
    color_material_id: colorMaterialId,
    paper_material_id: paperMaterialId,
    lacquer_material_id: lacquerMaterialId,
    foil_type,
    color_coverage,
  };
}

export const productMaterialIncludes = {
  foil_material: { select: { id: true, name: true, code: true, category_code: true } },
  color_material: { select: { id: true, name: true, code: true, category_code: true } },
  paper_material: { select: { id: true, name: true, code: true, category_code: true } },
  lacquer_material: { select: { id: true, name: true, code: true, category_code: true } },
} as const;

export async function migrateLegacyImlTablesIfPresent() {
  try {
    const foilRows = await prisma.$queryRawUnsafe<
      { id: number; name: string; code?: string | null; is_active?: number | boolean }[]
    >("SELECT id, name, code, is_active FROM iml_foils LIMIT 5000");
    for (const row of foilRows) {
      const existing = await prisma.materials.findFirst({
        where: { legacy_source: "iml_foils", legacy_id: row.id },
      });
      if (existing) continue;
      await prisma.materials.create({
        data: {
          category_code: "FOIL",
          name: row.name,
          code: row.code ?? null,
          is_active: row.is_active !== false && row.is_active !== 0,
          legacy_source: "iml_foils",
          legacy_id: row.id,
        },
      });
    }
  } catch {
    // tabulka nemusí existovat
  }

  try {
    const pantoneRows = await prisma.$queryRawUnsafe<
      { id: number; name: string; code?: string | null; is_active?: number | boolean }[]
    >("SELECT id, name, code, is_active FROM iml_pantone_colors LIMIT 5000");
    const pantoneSub = await prisma.material_subcategories.findFirst({
      where: { category_code: "COLOR", name: "PANTONE", parent_id: null },
    });
    for (const row of pantoneRows) {
      const existing = await prisma.materials.findFirst({
        where: { legacy_source: "iml_pantone_colors", legacy_id: row.id },
      });
      if (existing) continue;
      await prisma.materials.create({
        data: {
          category_code: "COLOR",
          subcategory_id: pantoneSub?.id ?? null,
          name: row.name,
          code: row.code ?? null,
          is_active: row.is_active !== false && row.is_active !== 0,
          legacy_source: "iml_pantone_colors",
          legacy_id: row.id,
        },
      });
    }
  } catch {
    // tabulka nemusí existovat
  }
}

export function categoryForLegacySource(source: string): MaterialCategoryCode | null {
  if (source === "iml_foils") return "FOIL";
  if (source === "iml_pantone_colors") return "COLOR";
  const code = normalizeCategoryCode(source);
  return code || null;
}
