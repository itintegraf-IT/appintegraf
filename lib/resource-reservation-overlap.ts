import type { Prisma, PrismaClient } from "@prisma/client";
import { BLOCKING_RESERVATION_STATUSES } from "@/lib/resource-reservation-types";

type Db = PrismaClient | Prisma.TransactionClient;

export type ResourceOverlapRow = {
  id: number;
  title: string;
  start_date: Date;
  end_date: Date;
  approval_status: string;
  resource_id: number;
};

export async function findResourceReservationOverlap(
  db: Db,
  resourceId: number,
  start: Date,
  end: Date,
  options: { excludeReservationId?: number } = {}
): Promise<ResourceOverlapRow | null> {
  const { excludeReservationId } = options;
  return db.resource_reservations.findFirst({
    where: {
      resource_id: resourceId,
      ...(excludeReservationId != null ? { id: { not: excludeReservationId } } : {}),
      approval_status: { in: BLOCKING_RESERVATION_STATUSES },
      start_date: { lt: end },
      end_date: { gt: start },
    },
    orderBy: { start_date: "asc" },
    select: {
      id: true,
      title: true,
      start_date: true,
      end_date: true,
      approval_status: true,
      resource_id: true,
    },
  });
}

export function formatResourceOverlapErrorCs(
  row: ResourceOverlapRow,
  resourceName: string,
  formatDateTime: (d: Date) => string
): string {
  const statusNote =
    row.approval_status === "pending" ? " (čeká na schválení)" : "";
  return `${resourceName} není v tomto termínu volné${statusNote}: „${row.title}“ (${formatDateTime(row.start_date)}–${formatDateTime(row.end_date)}).`;
}

export function datesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}
