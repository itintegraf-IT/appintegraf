import { prisma } from "@/lib/db";
import { DEFAULT_MATERIAL_CATEGORIES } from "@/lib/materialy/categories";

let ensured = false;

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${table}
      AND COLUMN_NAME = ${column}
  `;
  return Number(rows[0]?.cnt ?? 0) > 0;
}

/** Sloupec slug v material_categories + doplnění výchozích skupin. */
export async function ensureMaterialCategoriesSchema(): Promise<void> {
  if (ensured) return;

  const hasSlug = await columnExists("material_categories", "slug");
  if (!hasSlug) {
    try {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `material_categories` ADD COLUMN `slug` VARCHAR(80) NULL AFTER `label`"
      );
    } catch (e) {
      console.error("ensureMaterialCategoriesSchema ADD slug:", e);
    }
  }

  for (const c of DEFAULT_MATERIAL_CATEGORIES) {
    await prisma.material_categories.upsert({
      where: { code: c.code },
      create: { code: c.code, label: c.label, slug: c.slug, sort_order: c.sort_order },
      update: { label: c.label, slug: c.slug, sort_order: c.sort_order },
    });
  }

  const withoutSlug = await prisma.material_categories.findMany({
    where: { OR: [{ slug: null }, { slug: "" }] },
    select: { code: true },
  });
  for (const row of withoutSlug) {
    const def = DEFAULT_MATERIAL_CATEGORIES.find((c) => c.code === row.code);
    const slug = def?.slug ?? row.code.toLowerCase();
    await prisma.material_categories.update({
      where: { code: row.code },
      data: { slug },
    });
  }

  ensured = true;
}
