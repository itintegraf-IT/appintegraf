import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth-utils";
import { Calendar, Plus, Download } from "lucide-react";
import { CalendarNav } from "./CalendarNav";
import { CalendarTabs } from "./CalendarTabs";
import { CalendarViewToggle } from "./CalendarViewToggle";
import { WeekCalendarGrid } from "./WeekCalendarGrid";
import { MonthCalendarGrid } from "./MonthCalendarGrid";
import { getCurrentWeek, getWeekStart, getWeekEnd } from "./lib/week-utils";
import { getMonthGridStart, getMonthGridEnd } from "./lib/month-utils";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; scope?: string; view?: string; month?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  const admin = await isAdmin(userId);

  const params = await searchParams;
  const scope = params.scope === "mine" ? "mine" : "all";
  const view = params.view === "month" ? "month" : "week";

  const now = new Date();
  let from: string;
  let to: string;
  let month: string | undefined;

  if (view === "month") {
    const monthParam = params.month;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      month = monthParam;
    } else {
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    const monthDate = new Date(month + "-01");
    const gridStart = getMonthGridStart(monthDate);
    const gridEnd = getMonthGridEnd(monthDate);
    from = gridStart.toISOString().slice(0, 10);
    to = gridEnd.toISOString().slice(0, 10);
  } else {
    if (params.from) {
      const weekStart = getWeekStart(new Date(params.from));
      const weekEnd = getWeekEnd(weekStart);
      from = weekStart.toISOString().slice(0, 10);
      to = weekEnd.toISOString().slice(0, 10);
    } else {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(today);
      todayEnd.setDate(todayEnd.getDate() + 6);
      from = today.toISOString().slice(0, 10);
      to = todayEnd.toISOString().slice(0, 10);
    }
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  const baseWhere = {
    start_date: { lte: toDate } as const,
    end_date: { gte: fromDate } as const,
  };

  let where: typeof baseWhere & { OR?: Array<Record<string, unknown>> } = baseWhere;
  if (scope === "mine") {
    const managerDeptIds = await prisma.departments
      .findMany({
        where: { manager_id: userId },
        select: { id: true },
      })
      .then((r) => r.map((d) => d.id));

    const orConditions: Array<Record<string, unknown>> = [
      { created_by: userId },
      { deputy_id: userId },
    ];
    if (managerDeptIds.length > 0) {
      orConditions.push({
        approval_status: "deputy_approved",
        OR: [
          { department_id: { in: managerDeptIds } },
          { users: { department_id: { in: managerDeptIds } } },
        ],
      } as Record<string, unknown>);
    }
    where = { ...baseWhere, OR: orConditions };
  }

  const events = await prisma.calendar_events.findMany({
    where,
    orderBy: { start_date: "asc" },
    take: 200,
    include: {
      users: { select: { first_name: true, last_name: true } },
      departments: { select: { name: true } },
      users_deputy: { select: { first_name: true, last_name: true } },
    },
  });

  const eventsForGrid = events.map((e) => ({
    ...e,
    start_date: e.start_date,
    end_date: e.end_date,
  }));

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Calendar className="h-7 w-7 text-red-600" />
            Kalendář
          </h1>
          <p className="mt-1 text-gray-600">Události a termíny</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/calendar/export?scope=${admin ? "all" : "mine"}`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export .ics
          </a>
          <Link
            href="/calendar/add"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Nová událost
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <CalendarTabs scope={scope} />
        <CalendarViewToggle view={view} />
      </div>

      <CalendarNav view={view} from={from} to={to} month={month} />

      {view === "month" && month ? (
        <MonthCalendarGrid events={eventsForGrid} month={month} userId={userId} />
      ) : (
        <WeekCalendarGrid events={eventsForGrid} from={from} to={to} userId={userId} />
      )}
    </>
  );
}
