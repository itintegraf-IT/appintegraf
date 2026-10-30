import { prisma } from "@/lib/db";
import { maketyListNeedsAttention } from "@/lib/makety/makety-list-columns";

/**
 * Pro daná ID zakázek vrátí mapu needs_attention podle statusu a posledního status_log.
 */
export async function loadMaketyListNeedsAttentionMap(
  rows: Array<{ id: number; status: string }>
): Promise<Map<number, boolean>> {
  const result = new Map<number, boolean>();
  if (rows.length === 0) return result;

  const ids = rows.map((r) => r.id);
  const logs = await prisma.makety_status_log.findMany({
    where: { maketa_id: { in: ids } },
    orderBy: { id: "desc" },
    select: { maketa_id: true, from_status: true, to_status: true },
  });

  const lastByMaketa = new Map<
    number,
    { from_status: string | null; to_status: string }
  >();
  for (const log of logs) {
    if (!lastByMaketa.has(log.maketa_id)) {
      lastByMaketa.set(log.maketa_id, {
        from_status: log.from_status,
        to_status: log.to_status,
      });
    }
  }

  for (const row of rows) {
    const last = lastByMaketa.get(row.id);
    result.set(
      row.id,
      maketyListNeedsAttention(
        row.status,
        last?.from_status ?? null,
        last?.to_status ?? null
      )
    );
  }
  return result;
}
