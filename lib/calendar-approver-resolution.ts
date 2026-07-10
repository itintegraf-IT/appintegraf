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

/** Oddělení pro lookup v tabulce Schvalovatelé kalendáře (hlavní → první sekundární). */
export function resolveApproverDepartmentId(user: {
  department_id: number | null;
  user_secondary_departments?: Array<{ department_id: number }>;
}): number | null {
  if (user.department_id != null) return user.department_id;
  return user.user_secondary_departments?.[0]?.department_id ?? null;
}

/**
 * Uživatel je v daném termínu „nepřítomen“ (má kolidující událost mimo firmu).
 * Pro kontrolu zástupů a kolizí termínu události / rezervace.
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
 * Uživatel je v daném okamžiku nepřítomen (absence v kalendáři pokrývá tento čas).
 * Pro výběr schvalovatele v době žádosti – nezávisle na termínu schvalované události.
 */
export async function isUserAbsentAt(
  db: Db,
  userId: number,
  at: Date,
  excludeEventId?: number | null
): Promise<boolean> {
  return isUserAbsentInRange(db, userId, at, at, excludeEventId);
}

export type ResolveDepartmentCalendarApproverOptions = {
  /** Okamžik kontroly přítomnosti; výchozí = teď (doba žádosti). */
  presenceAt?: Date;
  excludeEventId?: number | null;
};

/**
 * Vybere finálního schvalovatele po zástupovi: primární → sekundární → terciární → manager_id.
 * Přítomnost se posuzuje v okamžiku žádosti (`presenceAt`), ne v termínu schvalované události.
 */
export async function resolveDepartmentCalendarApprover(
  db: Db,
  departmentId: number,
  options?: ResolveDepartmentCalendarApproverOptions
): Promise<ResolvedCalendarApprover | null> {
  const presenceAt = options?.presenceAt ?? new Date();
  const excludeEventId = options?.excludeEventId;
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
    const absent = await isUserAbsentAt(db, c.userId, presenceAt, excludeEventId);
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
