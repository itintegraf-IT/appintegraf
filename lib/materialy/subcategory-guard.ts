import { prisma } from "@/lib/db";

/** Ověří, že při existenci aktivních podtypů je vybrán jeden z nich a patří ke kategorii. */
export async function assertSubcategoryAllowed(
  category_code: string,
  subcategory_id: number | null
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const activeSubs = await prisma.material_subcategories.count({
    where: { category_code, is_active: true },
  });

  if (activeSubs > 0) {
    if (subcategory_id == null || !Number.isFinite(subcategory_id)) {
      return { ok: false, status: 400, error: "Vyberte podtyp materiálu." };
    }
  }

  if (subcategory_id != null && Number.isFinite(subcategory_id)) {
    const sub = await prisma.material_subcategories.findUnique({
      where: { id: subcategory_id },
      select: { category_code: true },
    });
    if (!sub || sub.category_code !== category_code) {
      return { ok: false, status: 400, error: "Neplatný podtyp pro zvolenou kategorii." };
    }
  }

  return { ok: true };
}
