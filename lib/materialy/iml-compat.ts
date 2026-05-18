import { prisma } from "@/lib/db";
import type { MaterialCategoryCode } from "@/lib/materialy/categories";

export function toImlFoilShape(m: {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  legacy_source: string | null;
  legacy_id: number | null;
}) {
  return {
    id: m.legacy_source === "iml_foils" && m.legacy_id ? m.legacy_id : m.id,
    material_id: m.id,
    name: m.name,
    code: m.code,
    description: m.description,
    is_active: m.is_active,
    created_at: m.created_at,
    updated_at: m.updated_at,
  };
}

export function toImlPantoneShape(m: {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  legacy_source: string | null;
  legacy_id: number | null;
}) {
  return {
    id: m.legacy_source === "iml_pantone_colors" && m.legacy_id ? m.legacy_id : m.id,
    material_id: m.id,
    name: m.name,
    code: m.code,
    pantone_code: m.code,
    description: m.description,
    is_active: m.is_active,
    created_at: m.created_at,
    updated_at: m.updated_at,
  };
}

export async function findMaterialForImlLegacyId(
  category: MaterialCategoryCode,
  legacySource: "iml_foils" | "iml_pantone_colors",
  id: number
) {
  const byLegacy = await prisma.materials.findFirst({
    where: { legacy_source: legacySource, legacy_id: id, category_code: category },
  });
  if (byLegacy) return byLegacy;
  return prisma.materials.findFirst({
    where: { id, category_code: category },
  });
}
