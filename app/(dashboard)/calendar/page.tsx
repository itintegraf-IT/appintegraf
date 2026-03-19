import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth-utils";
import { Calendar, Plus, Download } from "lucide-react";
import { CalendarNav } from "./CalendarNav";
import { CalendarTabs } from "./CalendarTabs";
import { CalendarViewToggle } from "./CalendarViewToggle";
import { CalendarSearch } from "./CalendarSearch";
import { WeekCalendarGrid } from "./WeekCalendarGrid";
import { MonthCalendarGrid } from "./MonthCalendarGrid";
import { CalendarSearchResults } from "./CalendarSearchResults";
import { CalendarListView } from "./CalendarListView";
import { getCurrentWeek, getWeekStart, getWeekEnd, formatDateLocal, parseDateLocal } from "./lib/week-utils";
import { getMonthGridStart, getMonthGridEnd } from "./lib/month-utils";
import { getHolidaysForRange } from "./lib/holidays";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    scope?: string;
    view?: string;
    month?: string;
    q?: string;
    display?: string;
    list_from?: string;
    list_to?: string;
  }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  const admin = await isAdmin(userId);

  const params = await searchParams;
  const scope = params.scope === "mine" ? "mine" : "all";
  const view =
    params.view === "month"
      ? "month"
      : params.view === "list_mine"
        ? "list_mine"
        : params.view === "list_all"
          ? "list_all"
          : "week";
  const searchQuery = params.q?.trim() || "";
  const showList = !!(searchQuery && params.display !== "calendar");
  const isListView = view === "list_mine" || view === "list_all";

  const now = new Date();
  let from: string;
  let to: string;
  let month: string | undefined;

  if (isListView) {
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (
      params.list_from &&
      params.list_to &&
      dateRe.test(params.list_from) &&
      dateRe.test(params.list_to)
    ) {
      from = params.list_from;
      to = params.list_to;
    } else {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const listEnd = new Date(today);
      listEnd.setDate(listEnd.getDate() + 13);
      from = formatDateLocal(today);
      to = formatDateLocal(listEnd);
    }
  } else if (view === "month") {
    const monthParam = params.month;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      month = monthParam;
    } else {
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    const monthDate = new Date(month + "-01");
    const gridStart = getMonthGridStart(monthDate);
    const gridEnd = getMonthGridEnd(monthDate);
    from = formatDateLocal(gridStart);
    to = formatDateLocal(gridEnd);
  } else {
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (params.from && params.to && dateRe.test(params.from) && dateRe.test(params.to)) {
      from = params.from;
      to = params.to;
    } else if (params.from && dateRe.test(params.from)) {
      const weekStart = getWeekStart(parseDateLocal(params.from));
      const weekEnd = getWeekEnd(weekStart);
      from = formatDateLocal(weekStart);
      to = formatDateLocal(weekEnd);
    } else {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(today);
      todayEnd.setDate(todayEnd.getDate() + 6);
      from = formatDateLocal(today);
      to = formatDateLocal(todayEnd);
    }
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  const baseWhere = {
    start_date: { lte: toDate } as const,
    end_date: { gte: fromDate } as const,
  };

  const buildScopeWhere = async (useScope?: "mine" | "all") => {
    const s = useScope ?? scope;
    if (s !== "mine") return {};
    const deptRows = await prisma.departments.findMany({
      where: { manager_id: userId },
      select: { id: true },
    });
    const managerDeptIds = (deptRows as Array<{ id: number }>).map((d) => d.id);

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
    return { OR: orConditions };
  };

  const buildSearchWhere = async () => {
    if (!searchQuery) return null;
    const userRows = await prisma.users.findMany({
      where: {
        OR: [
          { first_name: { contains: searchQuery } },
          { last_name: { contains: searchQuery } },
        ],
      },
      select: { id: true },
    });
    const matchingUserIds = (userRows as Array<{ id: number }>).map((u) => u.id);

    const searchConditions: Array<Record<string, unknown>> = [
      { title: { contains: searchQuery } },
      { description: { contains: searchQuery } },
      { location: { contains: searchQuery } },
    ];
    if (matchingUserIds.length > 0) {
      searchConditions.push(
        { created_by: { in: matchingUserIds } },
        { deputy_id: { in: matchingUserIds } },
        {
          calendar_event_participants: {
            some: { user_id: { in: matchingUserIds } },
          },
        } as Record<string, unknown>
      );
    }
    return { OR: searchConditions };
  };

  const searchWhere = await buildSearchWhere();

  const baseInclude = {
    users: { select: { first_name: true, last_name: true } },
    departments: { select: { name: true } },
    users_deputy: { select: { first_name: true, last_name: true } },
  };

  const listScope = view === "list_mine" ? "mine" : view === "list_all" ? "all" : null;
  const effectiveScope = listScope ?? scope;
  const scopeWhere = await buildScopeWhere(effectiveScope);

  let where: Record<string, unknown>;
  if (showList) {
    where = { ...scopeWhere };
    if (searchWhere) {
      where = Object.keys(where).length > 0 ? { AND: [where, searchWhere] } : searchWhere;
    }
  } else {
    where = { ...baseWhere, ...scopeWhere };
    if (searchWhere) {
      where = { AND: [where, searchWhere] };
    }
  }

  const listInclude = {
    ...baseInclude,
    calendar_event_participants: {
      include: { users: { select: { first_name: true, last_name: true } } },
    },
  };

  const events = await prisma.calendar_events.findMany({
    where,
    orderBy: { start_date: "asc" },
    take: 200,
    include: showList || isListView ? listInclude : baseInclude,
  });

  const eventsForGrid = events.map((e) => ({
    ...e,
    start_date: e.start_date,
    end_date: e.end_date,
  }));

  const holidays = getHolidaysForRange(from, to);

  const urlParams = new URLSearchParams();
  if (params.scope) urlParams.set("scope", params.scope);
  urlParams.set("view", isListView ? "week" : (params.view ?? "week"));
  if (params.q) urlParams.set("q", params.q);
  if (params.from) urlParams.set("from", params.from);
  if (params.to) urlParams.set("to", params.to);
  if (params.month) urlParams.set("month", params.month);
  urlParams.set("display", "calendar");
  urlParams.delete("list_from");
  urlParams.delete("list_to");
  const calendarUrl = `/calendar?${urlParams.toString()}`;

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
        {!isListView && <CalendarTabs scope={scope} />}
        <CalendarViewToggle view={view} />
        <CalendarSearch initialQuery={searchQuery} showList={showList} />
      </div>

      {isListView ? (
        <CalendarListView
          events={events}
          from={from}
          to={to}
          viewType={view as "list_mine" | "list_all"}
        />
      ) : showList ? (
        <CalendarSearchResults
          events={events}
          searchQuery={searchQuery}
          calendarUrl={calendarUrl}
        />
      ) : (
        <>
          <CalendarNav view={view as "week" | "month"} from={from} to={to} month={month} />
          {view === "month" && month ? (
            <MonthCalendarGrid events={eventsForGrid} holidays={holidays} month={month} userId={userId} />
          ) : (
            <WeekCalendarGrid events={eventsForGrid} holidays={holidays} from={from} to={to} userId={userId} />
          )}
        </>
      )}
    </>
  );
}
