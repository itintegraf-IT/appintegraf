import { prisma } from "@/lib/db";

/**
 * ID zákazníka, pod kterým je veden sdílený katalog produktů (centrála skupiny).
 * Pobočka → parent (centrála); samostatný / centrála → vlastní id.
 */
export async function resolveCatalogCustomerId(unitId: number): Promise<number> {
  const unit = await prisma.iml_customers.findUnique({
    where: { id: unitId },
    select: { id: true, parent_id: true },
  });
  if (!unit) return unitId;
  return unit.parent_id ?? unit.id;
}
