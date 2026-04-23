import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Překryv s jinou událostí téhož uživatele (jako tvůrce).
 * Nesmí se počítat sam sebe (excludeEventId).
 */
export async function findCreatorCalendarOverlap(
  db: Db,
  userId: number,
  start: Date,
  end: Date,
  options: { excludeEventId?: number } = {}
): Promise<{ id: number; title: string; start_date: Date; end_date: Date } | null> {
  const { excludeEventId } = options;
  return db.calendar_events.findFirst({
    where: {
      ...(excludeEventId != null ? { id: { not: excludeEventId } } : {}),
      created_by: userId,
      start_date: { lte: end },
      end_date: { gte: start },
    },
    orderBy: { start_date: "asc" },
    select: { id: true, title: true, start_date: true, end_date: true },
  });
}

export function formatOverlapErrorCs(
  row: { title: string; start_date: Date; end_date: Date },
  formatDateTime: (d: Date) => string
): string {
  return `Máte v tomto termínu kolidující událost: „${row.title}“ (${formatDateTime(row.start_date)}–${formatDateTime(row.end_date)}). Změňte termín nebo nejdřív upravte druhou událost.`;
}
