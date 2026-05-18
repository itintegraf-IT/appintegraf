import { prisma } from "@/lib/db";
import { logMaterialyAuditSafe } from "@/lib/materialy/audit";

export async function permanentDeleteSubcategory(
  id: number,
  userId: number,
  expectedCategory?: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const row = await prisma.material_subcategories.findUnique({ where: { id } });
  if (!row) {
    return { ok: false, status: 404, error: "Podtyp nenalezen." };
  }
  if (expectedCategory && row.category_code !== expectedCategory) {
    return { ok: false, status: 400, error: "Podtyp nepatří do zvolené kategorie materiálu." };
  }

  const materialCount = await prisma.materials.count({ where: { subcategory_id: id } });
  if (materialCount > 0) {
    return {
      ok: false,
      status: 409,
      error: `Podtyp „${row.name}" používá ${materialCount} materiál(ů). U těchto materiálů změňte nebo odeberte podtyp, poté zkuste smazat znovu.`,
    };
  }

  const children = await prisma.material_subcategories.findMany({
    where: { parent_id: id },
    select: { id: true, name: true },
  });
  for (const child of children) {
    const childMaterials = await prisma.materials.count({ where: { subcategory_id: child.id } });
    if (childMaterials > 0) {
      return {
        ok: false,
        status: 409,
        error: `Podřazený podtyp „${child.name}" má přiřazené materiály — nelze smazat nadřazený podtyp.`,
      };
    }
  }

  await prisma.$transaction([
    prisma.material_subcategories.deleteMany({ where: { parent_id: id } }),
    prisma.material_subcategories.delete({ where: { id } }),
  ]);

  await logMaterialyAuditSafe({
    userId,
    action: "delete",
    tableName: "material_subcategories",
    recordId: id,
    oldValues: { name: row.name, category_code: row.category_code },
    newValues: null,
  });

  return { ok: true };
}
