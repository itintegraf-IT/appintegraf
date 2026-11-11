import type { Prisma, PrismaClient } from "@prisma/client";
import { getHolidaysForRange } from "@/app/(dashboard)/calendar/lib/holidays";
import { CALENDAR_OUT_OF_OFFICE_TYPE_LIST } from "@/lib/calendar-out-of-office";
import {
  addDaysToYmdPrague,
  formatDateYmdPrague,
  getPragueParts,
  getPragueWeekdayIndex,
  parseDateTimeLocalInput,
} from "@/lib/datetime-cz";

export type CalendarApproverTier = "primary" | "secondary" | "tertiary" | "manager";

export type ResolvedCalendarApprover = {
  userId: number;
  tier: CalendarApproverTier;
  skippedTiers: CalendarApproverTier[];
  /** Schvalovatel je teď nepřítomen, ale stihne se vrátit včas – přiřazen a čeká se. */
  waitingForReturn?: boolean;
};

type Db = PrismaClient | Prisma.TransactionClient;

/** Kolik pracovních dní před začátkem události musí být schvalovatel zpět, aby se neeskálovalo. */
export const APPROVER_RETURN_BUFFER_WORKING_DAYS = 3;

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

/** Po–Pá a není český státní svátek / den pracovního klidu. */
export function isCzechWorkingDay(ymd: string): boolean {
  const weekday = getPragueWeekdayIndex(ymd);
  if (weekday >= 5) return false;
  return getHolidaysForRange(ymd, ymd).length === 0;
}

/**
 * Odečte N pracovních dní od data (Europe/Prague), zachová hodinu:minutu z `from`.
 */
export function subtractWorkingDays(from: Date, workingDays: number): Date {
  if (workingDays <= 0) return new Date(from.getTime());

  let ymd = formatDateYmdPrague(from);
  let remaining = workingDays;
  while (remaining > 0) {
    ymd = addDaysToYmdPrague(ymd, -1);
    if (isCzechWorkingDay(ymd)) remaining -= 1;
  }

  const p = getPragueParts(from);
  const h = String(p.hour).padStart(2, "0");
  const min = String(p.minute).padStart(2, "0");
  return parseDateTimeLocalInput(`${ymd}T${h}:${min}`);
}

/**
 * Nepřítomného schvalovatele ponechat, pokud se vrátí nejpozději
 * `APPROVER_RETURN_BUFFER_WORKING_DAYS` pracovních dní před začátkem události.
 */
export function shouldKeepAbsentApprover(
  returnAt: Date,
  eventStart: Date,
  bufferWorkingDays: number = APPROVER_RETURN_BUFFER_WORKING_DAYS
): boolean {
  const deadline = subtractWorkingDays(eventStart, bufferWorkingDays);
  return returnAt.getTime() <= deadline.getTime();
}

/**
 * Konec aktuální absence (OOO pokrývající `at`). Při více překryvech max(end_date).
 */
export async function getCurrentAbsenceEnd(
  db: Db,
  userId: number,
  at: Date,
  excludeEventId?: number | null
): Promise<Date | null> {
  const rows = await db.calendar_events.findMany({
    where: {
      ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
      created_by: userId,
      event_type: { in: CALENDAR_OUT_OF_OFFICE_TYPE_LIST },
      start_date: { lte: at },
      end_date: { gte: at },
      OR: [{ approval_status: { not: "rejected" } }, { approval_status: null }],
    },
    select: { end_date: true },
  });
  if (rows.length === 0) return null;
  let maxEnd = rows[0].end_date;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].end_date.getTime() > maxEnd.getTime()) maxEnd = rows[i].end_date;
  }
  return maxEnd;
}

export type ResolveDepartmentCalendarApproverOptions = {
  /** Okamžik kontroly přítomnosti; výchozí = teď (doba žádosti). */
  presenceAt?: Date;
  /** Začátek schvalované události – pro rozhodnutí „počkat na návrat“. */
  eventStart: Date;
  excludeEventId?: number | null;
};

/**
 * Vybere finálního schvalovatele po zástupovi: primární → sekundární → terciární → manager_id.
 * Přítomnost se posuzuje v okamžiku žádosti (`presenceAt`).
 * Nepřítomný se nepřeskakuje, pokud se vrátí ≥ 3 pracovní dny před `eventStart`.
 */
export async function resolveDepartmentCalendarApprover(
  db: Db,
  departmentId: number,
  options: ResolveDepartmentCalendarApproverOptions
): Promise<ResolvedCalendarApprover | null> {
  const presenceAt = options.presenceAt ?? new Date();
  const eventStart = options.eventStart;
  const excludeEventId = options.excludeEventId;
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

    const returnAt = await getCurrentAbsenceEnd(db, c.userId, presenceAt, excludeEventId);
    if (returnAt && shouldKeepAbsentApprover(returnAt, eventStart)) {
      return {
        userId: c.userId,
        tier: c.tier,
        skippedTiers,
        waitingForReturn: true,
      };
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
  skippedTiers: CalendarApproverTier[],
  waitingForReturn?: boolean
): string {
  const tierLabel = calendarApproverTierLabel(tier);
  const waitSuffix = waitingForReturn
    ? " – nepřítomen, návrat včas, čeká se na schválení"
    : "";
  if (skippedTiers.length === 0) {
    return `Předáno ke schválení: ${approverName} (${tierLabel}${waitSuffix}).`;
  }
  const skipped = skippedTiers.map(calendarApproverTierLabel).join(", ");
  return `Předáno ke schválení: ${approverName} (${tierLabel}${waitSuffix} – ${skipped} nepřítomen/nepřítomni).`;
}
