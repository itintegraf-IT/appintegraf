import { prisma } from "@/lib/db";
import type { MaterialCategoryCode } from "@/lib/materialy/categories";

type SubName = { name: string } | null | undefined;

function inferColorKind(subName: string | null | undefined, row: { cmyk_c: number | null; cmyk_m: number | null; cmyk_y: number | null; cmyk_k: number | null }): "pantone" | "cmyk" {
  if (subName === "CMYK") return "cmyk";
  const hasCmyk =
    row.cmyk_c != null && row.cmyk_m != null && row.cmyk_y != null && row.cmyk_k != null;
  if (hasCmyk) return "cmyk";
  return "pantone";
}

type FoilRow = {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  notes: string | null;
  thickness_label: string | null;
  subcategory_id: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  legacy_source: string | null;
  legacy_id: number | null;
  material_subcategories?: SubName;
};

export function toImlFoilShape(m: FoilRow) {
  return {
    id: m.legacy_source === "iml_foils" && m.legacy_id ? m.legacy_id : m.id,
    material_id: m.id,
    name: m.name,
    code: m.code,
    thickness_label: m.thickness_label ?? null,
    notes: m.notes ?? null,
    description: m.description,
    subcategory_id: m.subcategory_id ?? null,
    subcategory_name: m.material_subcategories?.name ?? null,
    is_active: m.is_active,
    created_at: m.created_at,
    updated_at: m.updated_at,
  };
}

type PantoneRow = {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  hex_color: string | null;
  cmyk_c: number | null;
  cmyk_m: number | null;
  cmyk_y: number | null;
  cmyk_k: number | null;
  subcategory_id: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  legacy_source: string | null;
  legacy_id: number | null;
  material_subcategories?: SubName;
};

export function toImlPantoneShape(m: PantoneRow) {
  const subName = m.material_subcategories?.name ?? null;
  const color_kind = inferColorKind(subName, m);
  return {
    id: m.legacy_source === "iml_pantone_colors" && m.legacy_id ? m.legacy_id : m.id,
    material_id: m.id,
    name: m.name,
    code: m.code,
    pantone_code: m.code,
    description: m.description,
    hex_color: m.hex_color ?? null,
    hex: m.hex_color ?? null,
    cmyk_c: m.cmyk_c ?? null,
    cmyk_m: m.cmyk_m ?? null,
    cmyk_y: m.cmyk_y ?? null,
    cmyk_k: m.cmyk_k ?? null,
    subcategory_id: m.subcategory_id ?? null,
    subcategory_name: subName,
    color_kind,
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
    include: { material_subcategories: { select: { name: true } } },
  });
  if (byLegacy) return byLegacy;
  return prisma.materials.findFirst({
    where: { id, category_code: category },
    include: { material_subcategories: { select: { name: true } } },
  });
}
