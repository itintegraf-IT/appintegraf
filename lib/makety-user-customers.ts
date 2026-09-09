/** Sync přiřazení IML klientů pro roli Prohlížeč klienta. */

import { prisma } from "@/lib/db";
import { hasMaketyProhlizecKlientaFlag } from "@/lib/makety-module-access-flags";

export async function syncMaketyUserCustomers(
  userId: number,
  moduleAccess: Record<string, string>,
  customerIds: unknown
): Promise<void> {
  const enabled = hasMaketyProhlizecKlientaFlag(moduleAccess);
  if (!enabled) {
    await prisma.makety_user_customers.deleteMany({ where: { user_id: userId } });
    return;
  }

  const raw = Array.isArray(customerIds) ? customerIds : [];
  const ids = [
    ...new Set(
      raw
        .map((v) => (typeof v === "number" ? v : parseInt(String(v), 10)))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];

  await prisma.$transaction(async (tx) => {
    await tx.makety_user_customers.deleteMany({ where: { user_id: userId } });
    if (ids.length === 0) return;

    const existing = await tx.iml_customers.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (existing.length === 0) return;

    await tx.makety_user_customers.createMany({
      data: existing.map((c) => ({ user_id: userId, customer_id: c.id })),
    });
  });
}

export async function getMaketyUserCustomerIds(userId: number): Promise<number[]> {
  const rows = await prisma.makety_user_customers.findMany({
    where: { user_id: userId },
    select: { customer_id: true },
  });
  return rows.map((r) => r.customer_id);
}
