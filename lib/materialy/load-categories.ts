import { prisma } from "@/lib/db";
import {
  DEFAULT_MATERIAL_CATEGORIES,
  normalizeCategoryCode,
  slugifyCategoryLabel,
  type MaterialCategoryRow,
} from "@/lib/materialy/categories";
import { ensureMaterialCategoriesSchema } from "@/lib/materialy/ensure-material-categories-schema";

let cache: { at: number; rows: MaterialCategoryRow[] } | null = null;
const CACHE_MS = 15_000;

export function invalidateMaterialCategoriesCache(): void {
  cache = null;
}

function mapRow(r: { code: string; label: string; slug: string | null; sort_order: number }): MaterialCategoryRow {
  return {
    code: r.code,
    label: r.label,
    slug: r.slug ?? slugifyCategoryLabel(r.label),
    sort_order: r.sort_order,
  };
}

async function seedDefaultCategories(): Promise<void> {
  for (const c of DEFAULT_MATERIAL_CATEGORIES) {
    await prisma.material_categories.upsert({
      where: { code: c.code },
      create: { code: c.code, label: c.label, slug: c.slug, sort_order: c.sort_order },
      update: { label: c.label, slug: c.slug, sort_order: c.sort_order },
    });
  }
}

export async function getMaterialCategories(): Promise<MaterialCategoryRow[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;

  await ensureMaterialCategoriesSchema();

  let rows = await prisma.material_categories.findMany({
    orderBy: [{ sort_order: "asc" }, { label: "asc" }],
  });

  if (rows.length === 0) {
    await seedDefaultCategories();
    rows = await prisma.material_categories.findMany({
      orderBy: [{ sort_order: "asc" }, { label: "asc" }],
    });
  }

  const mapped = rows.map(mapRow);
  cache = { at: Date.now(), rows: mapped };
  return mapped;
}

export async function isMaterialCategoryCode(code: string): Promise<boolean> {
  const normalized = normalizeCategoryCode(code);
  if (!normalized) return false;
  const cats = await getMaterialCategories();
  return cats.some((c) => c.code === normalized);
}

export async function findCategoryBySlug(slug: string): Promise<MaterialCategoryRow | null> {
  const s = slug.trim().toLowerCase();
  if (!s) return null;
  const cats = await getMaterialCategories();
  return cats.find((c) => c.slug === s) ?? null;
}

export async function findCategoryByCode(code: string): Promise<MaterialCategoryRow | null> {
  const normalized = normalizeCategoryCode(code);
  if (!normalized) return null;
  const cats = await getMaterialCategories();
  return cats.find((c) => c.code === normalized) ?? null;
}

export async function resolveCategoryCode(param: string | null): Promise<string | null> {
  if (param == null || param.trim() === "") return null;
  const normalized = normalizeCategoryCode(param);
  if (!(await isMaterialCategoryCode(normalized))) return null;
  return normalized;
}
