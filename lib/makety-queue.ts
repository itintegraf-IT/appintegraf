import { prisma } from "@/lib/db";
import type { MaketaPriority } from "@/lib/makety-status";
import { type MaketyWorkType } from "@/lib/makety-work-type";

export type MaketyQueueRow = {
  id: number;
  body: string;
  order_number: string | null;
  priority: string;
  queue_position: number | null;
  due_at: Date;
  status: string;
  work_type: string;
  assignee_user_id: number | null;
};

import { MAKETY_PRODUCTION_QUEUE_STATUSES } from "@/lib/makety-status";

const ACTIVE_STATUSES = MAKETY_PRODUCTION_QUEUE_STATUSES;

export function prioritySortKey(priority: string): number {
  switch (priority) {
    case "urgent":
      return 0;
    case "high":
      return 1;
    default:
      return 2;
  }
}

/** Výchozí pořadí bez ručního queue_position (termín + priorita). */
export function defaultQueueSortKey(row: {
  due_at: Date;
  priority: string;
  id: number;
}): number {
  const due = new Date(row.due_at).getTime();
  const prio = prioritySortKey(row.priority) * 86_400_000;
  return due + prio;
}

export function compareMaketyProductionQueue(
  a: MaketyQueueRow,
  b: MaketyQueueRow
): number {
  const aManual = a.queue_position != null;
  const bManual = b.queue_position != null;

  if (aManual && bManual) {
    const diff = a.queue_position! - b.queue_position!;
    if (diff !== 0) return diff;
  } else if (aManual && !bManual) {
    return -1;
  } else if (!aManual && bManual) {
    return 1;
  }

  const autoDiff = defaultQueueSortKey(a) - defaultQueueSortKey(b);
  if (autoDiff !== 0) return autoDiff;
  return a.id - b.id;
}

export function sortMaketyProductionQueue<T extends MaketyQueueRow>(rows: T[]): T[] {
  return [...rows].sort(compareMaketyProductionQueue);
}

/** Fronta per přiřazený uživatel (work_type × assignee). */
export function sortMaketyProductionQueueByAssignee<
  T extends MaketyQueueRow & { assignee_user_id: number | null },
>(rows: T[]): T[] {
  const unassigned: T[] = [];
  const byAssignee = new Map<number, T[]>();

  for (const row of rows) {
    const aid = row.assignee_user_id;
    if (aid == null) {
      unassigned.push(row);
      continue;
    }
    if (!byAssignee.has(aid)) byAssignee.set(aid, []);
    byAssignee.get(aid)!.push(row);
  }

  const assigneeIds = [...byAssignee.keys()].sort((a, b) => a - b);
  const result: T[] = [];
  for (const aid of assigneeIds) {
    result.push(...sortMaketyProductionQueue(byAssignee.get(aid)!));
  }
  result.push(...sortMaketyProductionQueue(unassigned));
  return result;
}

/** Nová aktivní zakázka na konec fronty daného výrobce. */
export async function nextQueuePositionForAssignee(
  workType: MaketyWorkType,
  assigneeUserId: number
): Promise<number> {
  const agg = await prisma.makety.aggregate({
    where: {
      work_type: workType,
      assignee_user_id: assigneeUserId,
      status: { in: [...ACTIVE_STATUSES] },
      queue_position: { not: null },
    },
    _max: { queue_position: true },
  });
  const max = agg._max.queue_position ?? 0;
  return max + 1000;
}
