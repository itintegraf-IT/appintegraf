import type { Prisma, PrismaClient } from "@prisma/client";
import { CALENDAR_OUT_OF_OFFICE_TYPE_LIST } from "@/lib/calendar-out-of-office";

export type CalendarApproverTier = "primary" | "secondary" | "tertiary" | "manager";

export type ResolvedCalendarApprover = {
  userId: number;
  tier: CalendarApproverTier;
  skippedTiers: CalendarApproverTier[];
};

type Db = PrismaClient | Prisma.TransactionClient;

const TIER_LABELS: Record<CalendarApproverTier, string> = {
  primary: "primární schvalovatel",
  secondary: "sekundární schvalovatel",
  tertiary: "terciární schvalovatel",
  manager: "vedoucí oddělení",
};

export function calendarApproverTierLabel(tier: CalendarApproverTier): string {
  return TIER_LABELS[tier];
}

/**
 * Uživatel je v daném termínu „nepřítomen“ (má kolidující událost mimo firmu).
 */
export async function isUserAbsentInRange(
  db: Db,
  userId: number,
  start: Date,
  end: Date,
  excludeEventId?: number | null
): Promise<boolean> {
  const overlap = await db.calendar_events.findFirst({
    where: {
      ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
      created_by: userId,
      event_type: { in: CALENDAR_OUT_OF_OFFICE_TYPE_LIST },
      start_date: { lte: end },
      end_date: { gte: start },
      OR: [{ approval_status: { not: "rejected" } }, { approval_status: null }],
    },
    select: { id: true },
  });
  return overlap !== null;
}

/**
 * Vybere finálního schvalovatele po zástupovi: primární → sekundární → terciární → manager_id.
 */
export async function resolveDepartmentCalendarApprover(
  db: Db,
  departmentId: number,
  start: Date,
  end: Date,
  excludeEventId?: number | null
): Promise<ResolvedCalendarApprover | null> {
  const dept = await db.departments.findUnique({
    where: { id: departmentId },
    select: {
      manager_id: true,
      calendar_department_approvers: {
        select: {
          primary_user_id: true,
          secondary_user_id: true,
          tertiary_user_id: true,
        },
      },
    },
  });

  if (!dept) return null;

  const config = dept.calendar_department_approvers;
  const skippedTiers: CalendarApproverTier[] = [];

  if (!config) {
    if (dept.manager_id) {
      return { userId: dept.manager_id, tier: "manager", skippedTiers };
    }
    return null;
  }

  const candidates: Array<{ userId: number; tier: CalendarApproverTier }> = [
    { userId: config.primary_user_id, tier: "primary" },
  ];
  if (config.secondary_user_id) {
    candidates.push({ userId: config.secondary_user_id, tier: "secondary" });
  }
  if (config.tertiary_user_id) {
    candidates.push({ userId: config.tertiary_user_id, tier: "tertiary" });
  }

  for (const c of candidates) {
    const absent = await isUserAbsentInRange(db, c.userId, start, end, excludeEventId);
    if (!absent) {
      return { userId: c.userId, tier: c.tier, skippedTiers };
    }
    skippedTiers.push(c.tier);
  }

  if (dept.manager_id) {
    return { userId: dept.manager_id, tier: "manager", skippedTiers };
  }

  return null;
}

export function formatApproverAssignmentNote(
  approverName: string,
  tier: CalendarApproverTier,
  skippedTiers: CalendarApproverTier[]
): string {
  const tierLabel = calendarApproverTierLabel(tier);
  if (skippedTiers.length === 0) {
    return `Předáno ke schválení: ${approverName} (${tierLabel}).`;
  }
  const skipped = skippedTiers.map(calendarApproverTierLabel).join(", ");
  return `Předáno ke schválení: ${approverName} (${tierLabel} – ${skipped} nepřítomen/nepřítomni).`;
}
