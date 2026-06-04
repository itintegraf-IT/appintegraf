import { prisma } from "@/lib/db";
import {
  canViewAllMaketyTypes,
} from "@/lib/makety-access";
import {
  hasMaketyGrafikaAccess,
  hasMaketyVyrobaAccess,
} from "@/lib/auth-utils";
import { sortMaketyProductionQueueByAssignee } from "@/lib/makety-queue";
import { type MaketyWorkType } from "@/lib/makety-work-type";

function isMissingMaketyTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  if (code === "P2021" || code === "P2010") return true;
  const msg = "message" in err ? String((err as { message: unknown }).message) : String(err);
  return /makety/i.test(msg) && /does not exist|existuje|Unknown table/i.test(msg);
}

export const MAKETY_CALENDAR_COLOR = "#7C3AED";
export const MAKETY_CALENDAR_IN_PROGRESS_COLOR = "#F59E0B";
export const MAKETY_CALENDAR_DONE_COLOR = "#16A34A";
export const GRAFIKA_CALENDAR_COLOR = "#2563EB";

function maketaCalendarColorByStatus(status: string, priority: string, workType: MaketyWorkType): string {
  if (status === "in_progress") return MAKETY_CALENDAR_IN_PROGRESS_COLOR;
  if (status === "done") return MAKETY_CALENDAR_DONE_COLOR;
  if (priority === "urgent") return "#DC2626";
  if (priority === "high") return "#EA580C";
  return workType === "grafika" ? GRAFIKA_CALENDAR_COLOR : MAKETY_CALENDAR_COLOR;
}

export type MaketyGridEvent = {
  id: number;
  title: string;
  description: string | null;
  start_date: Date;
  end_date: Date;
  event_type: string | null;
  color: string | null;
  location: string | null;
  deputy_id: number | null;
  approval_status: string | null;
  created_by: number;
  users: { first_name: string; last_name: string } | null;
  users_deputy: { first_name: string; last_name: string } | null;
  makety_task_id: number;
};

export function maketaToGridEvent(maketa: {
  id: number;
  body: string;
  order_number: string | null;
  work_type?: string | null;
  assigned_at: Date;
  due_at: Date;
  priority: string;
  status: string;
  created_by: number;
  users_assignee: { first_name: string; last_name: string } | null;
}): MaketyGridEvent {
  const workType: MaketyWorkType = maketa.work_type === "grafika" ? "grafika" : "maketa";
  const typeLabel = workType === "grafika" ? "Grafika" : "Maketa";
  const assigned = new Date(maketa.assigned_at);
  const due = new Date(maketa.due_at);
  const start = new Date(assigned.getFullYear(), assigned.getMonth(), assigned.getDate(), 0, 0, 0, 0);
  const end = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 0, 0);
  if (end < start) end.setTime(start.getTime() + 23 * 60 * 60 * 1000);
  const preview = maketa.body.replace(/\s+/g, " ").trim().slice(0, 60);
  const urgentMark = maketa.priority === "urgent" ? " ⚠" : "";
  const title = maketa.order_number
    ? `${typeLabel} → zak. ${maketa.order_number}${urgentMark}`
    : `${typeLabel}${urgentMark}: ${preview || "bez popisu"}`;

  return {
    id: maketa.id,
    title,
    description: maketa.body,
    start_date: start,
    end_date: end,
    event_type: workType,
    color: maketaCalendarColorByStatus(maketa.status, maketa.priority, workType),
    location: null,
    deputy_id: null,
    approval_status: null,
    created_by: maketa.created_by,
    users: maketa.users_assignee,
    users_deputy: null,
    makety_task_id: maketa.id,
  };
}

export type MaketyCalendarMode = "personal" | "vyroba" | "grafika";

/** Org přehled (vyroba/grafika) nebo personal filtr pro zadavatele. */
export async function resolveMaketyCalendarFetchParams(
  userId: number,
  workType: MaketyWorkType
): Promise<{ mode: MaketyCalendarMode; workType?: MaketyWorkType }> {
  if (await canViewAllMaketyTypes(userId)) {
    return { mode: workType === "grafika" ? "grafika" : "vyroba" };
  }
  if (workType === "maketa" && (await hasMaketyVyrobaAccess(userId))) {
    return { mode: "vyroba" };
  }
  if (workType === "grafika" && (await hasMaketyGrafikaAccess(userId))) {
    return { mode: "grafika" };
  }
  return { mode: "personal", workType };
}

export async function fetchMaketyForCalendarRange(params: {
  fromDate: Date;
  toDate: Date;
  userId: number;
  mode: MaketyCalendarMode;
  /** U režimu personal omezí na maketa nebo grafika (zadavatel v modulovém kalendáři). */
  workType?: MaketyWorkType;
}): Promise<MaketyGridEvent[]> {
  const { fromDate, toDate, userId, mode, workType } = params;

  let where: Record<string, unknown> = {
    status: { notIn: ["done", "cancelled"] },
    assigned_at: { lte: toDate },
    due_at: { gte: fromDate },
  };

  if (mode === "personal") {
    where = {
      ...where,
      OR: [{ assignee_user_id: userId }, { created_by: userId }],
    };
    if (workType) where.work_type = workType;
  } else if (mode === "vyroba") {
    where.work_type = "maketa";
  } else if (mode === "grafika") {
    where.work_type = "grafika";
  }

  try {
    const rows = await prisma.makety.findMany({
      where,
      take: 300,
      include: {
        users_assignee: { select: { first_name: true, last_name: true } },
      },
    });

    const sorted =
      mode === "vyroba" || mode === "grafika"
        ? sortMaketyProductionQueueByAssignee(rows)
        : rows.sort(
            (a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
          );

    return sorted.map(maketaToGridEvent);
  } catch (err) {
    if (isMissingMaketyTableError(err)) {
      console.warn("[makety-calendar] Tabulka makety v DB chybí – spusťte npm run db:makety-migrate");
      return [];
    }
    throw err;
  }
}
