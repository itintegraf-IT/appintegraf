import { prisma } from "@/lib/db";
import { getUserDepartmentIds } from "@/lib/ukoly-recipients";

/** Výchozí barva úkolů v kalendáři (stav "open"). */
export const UKOLY_CALENDAR_COLOR = "#DC2626";
export const UKOLY_CALENDAR_IN_PROGRESS_COLOR = "#F59E0B";
export const UKOLY_CALENDAR_DONE_COLOR = "#16A34A";

function ukolCalendarColorByStatus(status: string): string {
  switch (status) {
    case "in_progress":
      return UKOLY_CALENDAR_IN_PROGRESS_COLOR;
    case "done":
      return UKOLY_CALENDAR_DONE_COLOR;
    case "open":
    default:
      return UKOLY_CALENDAR_COLOR;
  }
}

export type UkolyGridEvent = {
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
  ukoly_task_id: number;
};

export function ukolToGridEvent(ukol: {
  id: number;
  body: string;
  order_number: string | null;
  assigned_at: Date;
  due_at: Date;
  urgent: boolean;
  status: string;
  created_by: number;
  users_assignee: { first_name: string; last_name: string } | null;
}): UkolyGridEvent {
  const assigned = new Date(ukol.assigned_at);
  const due = new Date(ukol.due_at);
  const start = new Date(assigned.getFullYear(), assigned.getMonth(), assigned.getDate(), 0, 0, 0, 0);
  const end = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 0, 0);
  if (end < start) end.setTime(start.getTime() + 23 * 60 * 60 * 1000);
  const preview = ukol.body.replace(/\s+/g, " ").trim().slice(0, 60);
  const title = ukol.order_number
    ? `Úkol -> zak. ${ukol.order_number}${ukol.urgent ? " ⚠" : ""}`
    : `Úkol${ukol.urgent ? " ⚠" : ""}: ${preview || "bez popisu"}`;

  return {
    id: ukol.id,
    title,
    description: ukol.body,
    start_date: start,
    end_date: end,
    event_type: "ukol",
    color: ukolCalendarColorByStatus(ukol.status),
    location: null,
    deputy_id: null,
    approval_status: null,
    created_by: ukol.created_by,
    users: ukol.users_assignee,
    users_deputy: null,
    ukoly_task_id: ukol.id,
  };
}

type CalendarScope = "all" | "mine";

export async function fetchUkolyForCalendarRange(params: {
  fromDate: Date;
  toDate: Date;
  userId: number;
  scope: CalendarScope;
}): Promise<UkolyGridEvent[]> {
  const { fromDate, toDate, userId, scope } = params;

  let where: Record<string, unknown> = {
    status: { notIn: ["done", "cancelled"] },
    assigned_at: { lte: toDate },
    due_at: { gte: fromDate },
  };

  if (scope === "mine") {
    const deptIds = await getUserDepartmentIds(userId);
    const or: Record<string, unknown>[] = [
      { assignee_user_id: userId },
    ];
    if (deptIds.length > 0) {
      or.push({
        ukoly_departments: { some: { department_id: { in: deptIds } } },
      });
    }
    where = { ...where, OR: or };
  }

  const rows = await prisma.ukoly.findMany({
    where,
    orderBy: { due_at: "asc" },
    take: 300,
    include: {
      users_assignee: { select: { first_name: true, last_name: true } },
    },
  });

  return rows.map(ukolToGridEvent);
}
