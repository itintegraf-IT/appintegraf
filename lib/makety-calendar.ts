import { prisma } from "@/lib/db";

export const MAKETY_CALENDAR_COLOR = "#7C3AED";
export const MAKETY_CALENDAR_IN_PROGRESS_COLOR = "#F59E0B";
export const MAKETY_CALENDAR_DONE_COLOR = "#16A34A";

function maketaCalendarColorByStatus(status: string, priority: string): string {
  if (status === "in_progress") return MAKETY_CALENDAR_IN_PROGRESS_COLOR;
  if (status === "done") return MAKETY_CALENDAR_DONE_COLOR;
  if (priority === "urgent") return "#DC2626";
  if (priority === "high") return "#EA580C";
  return MAKETY_CALENDAR_COLOR;
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
  assigned_at: Date;
  due_at: Date;
  priority: string;
  status: string;
  created_by: number;
  users_assignee: { first_name: string; last_name: string } | null;
}): MaketyGridEvent {
  const assigned = new Date(maketa.assigned_at);
  const due = new Date(maketa.due_at);
  const start = new Date(assigned.getFullYear(), assigned.getMonth(), assigned.getDate(), 0, 0, 0, 0);
  const end = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 0, 0);
  if (end < start) end.setTime(start.getTime() + 23 * 60 * 60 * 1000);
  const preview = maketa.body.replace(/\s+/g, " ").trim().slice(0, 60);
  const urgentMark = maketa.priority === "urgent" ? " ⚠" : "";
  const title = maketa.order_number
    ? `Maketa → zak. ${maketa.order_number}${urgentMark}`
    : `Maketa${urgentMark}: ${preview || "bez popisu"}`;

  return {
    id: maketa.id,
    title,
    description: maketa.body,
    start_date: start,
    end_date: end,
    event_type: "maketa",
    color: maketaCalendarColorByStatus(maketa.status, maketa.priority),
    location: null,
    deputy_id: null,
    approval_status: null,
    created_by: maketa.created_by,
    users: maketa.users_assignee,
    users_deputy: null,
    makety_task_id: maketa.id,
  };
}

type CalendarMode = "personal" | "vyroba";

export async function fetchMaketyForCalendarRange(params: {
  fromDate: Date;
  toDate: Date;
  userId: number;
  mode: CalendarMode;
}): Promise<MaketyGridEvent[]> {
  const { fromDate, toDate, userId, mode } = params;

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
  }

  const rows = await prisma.makety.findMany({
    where,
    orderBy: { due_at: "asc" },
    take: 300,
    include: {
      users_assignee: { select: { first_name: true, last_name: true } },
    },
  });

  return rows.map(maketaToGridEvent);
}
