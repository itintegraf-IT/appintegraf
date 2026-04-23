import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { isAdmin, hasModuleAccess } from "@/lib/auth-utils";
import { Calendar, Plus, Download } from "lucide-react";
import { CalendarNav } from "./CalendarNav";
import { CalendarTabs } from "./CalendarTabs";
import { CalendarViewToggle } from "./CalendarViewToggle";
import { CalendarSearch } from "./CalendarSearch";
import { WeekCalendarGrid } from "./WeekCalendarGrid";
import { MonthCalendarGrid } from "./MonthCalendarGrid";
import { CalendarSearchResults } from "./CalendarSearchResults";
import { CalendarListView } from "./CalendarListView";
import { getWeekStart, getWeekEnd, formatDateLocal, parseDateLocal } from "./lib/week-utils";
import { getMonthGridStart, getMonthGridEnd } from "./lib/month-utils";
import { getHolidaysForRange } from "./lib/holidays";
import { getUserDepartmentIds } from "@/lib/ukoly-recipients";
import { fetchUkolyForCalendarRange, UKOLY_CALENDAR_COLOR } from "@/lib/ukoly-calendar";
import { isUserInVedeniDepartment } from "@/lib/calendar-vedeni";
import type { CalendarEventMetaMode } from "@/lib/calendar-event-meta";

type CalendarScope = "all" | "mine";

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
  const hasUkoly = await hasModuleAccess(userId, "ukoly", "read");
  const isVedeni = userId > 0 ? await isUserInVedeniDepartment(userId) : false;

  const params = await searchParams;

  const calendarScope: CalendarScope = params.scope === "all" ? "all" : "mine";

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

  const buildScopeWhere = async (effectiveScope: CalendarScope): Promise<Record<string, unknown>> => {
    if (effectiveScope === "all") return {};
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
  const buildTaskSearchWhere = async () => {
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
    const cond: Array<Record<string, unknown>> = [
      { body: { contains: searchQuery } },
      { order_number: { contains: searchQuery } },
    ];
    if (matchingUserIds.length > 0) {
      cond.push({ assignee_user_id: { in: matchingUserIds } });
    }
    return { OR: cond };
  };

  const baseInclude = {
    users: { select: { first_name: true, last_name: true } },
    departments: { select: { name: true } },
    users_deputy: { select: { first_name: true, last_name: true } },
    calendar_approvals: {
      where: { approval_type: "manager", status: "approved" },
      take: 1,
      include: { users: { select: { first_name: true, last_name: true } } },
    },
  };

  const listScope: CalendarScope | null =
    view === "list_mine" ? "mine" : view === "list_all" ? "all" : null;
  const effectiveScope: CalendarScope = listScope ?? calendarScope;
  const eventMetaMode: CalendarEventMetaMode =
    effectiveScope !== "all"
      ? "hidden"
      : isVedeni
        ? "global_vedeni"
        : "global";
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

  if (effectiveScope === "all") {
    where = { ...where, is_private: { not: true } };
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

  let taskSearchRows:
    | Array<{
        id: number;
        body: string;
        order_number: string | null;
        assigned_at: Date;
        due_at: Date;
        urgent: boolean;
        status: string;
        created_by: number;
        users_assignee: { first_name: string; last_name: string } | null;
      }>
    | null = null;
  if (hasUkoly && showList && searchQuery) {
    const taskScope: CalendarScope = effectiveScope === "mine" ? "mine" : "all";
    const taskWhereBase: Record<string, unknown> = {
      status: { notIn: ["done", "cancelled"] },
      assigned_at: { lte: toDate },
      due_at: { gte: fromDate },
    };
    if (taskScope === "mine") {
      const mineDeptIds = await getUserDepartmentIds(userId);
      const or: Array<Record<string, unknown>> = [{ assignee_user_id: userId }];
      if (mineDeptIds.length > 0) {
        or.push({ ukoly_departments: { some: { department_id: { in: mineDeptIds } } } });
      }
      taskWhereBase.OR = or;
    }
    const taskSearchWhere = await buildTaskSearchWhere();
    const mergedTaskWhere =
      taskSearchWhere != null ? { AND: [taskWhereBase, taskSearchWhere] } : taskWhereBase;
    taskSearchRows = await prisma.ukoly.findMany({
      where: mergedTaskWhere,
      orderBy: { due_at: "asc" },
      take: 200,
      include: {
        users_assignee: { select: { first_name: true, last_name: true } },
      },
    });
  }

  type GridEvent = {
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
    calendar_approvals?: Array<{ users: { first_name: string; last_name: string } | null }>;
    ukoly_task_id?: number | null;
    calendar_event_participants?: Array<{
      users: { first_name: string; last_name: string } | null;
    }>;
    [key: string]: unknown;
  };

  const eventsAsGrid: GridEvent[] = events as GridEvent[];

  let eventsForGrid: GridEvent[] = eventsAsGrid;
  let listMerged: GridEvent[] = eventsAsGrid;
  let searchMerged: GridEvent[] = eventsAsGrid;

  if (hasUkoly && !showList) {
    const taskScope: CalendarScope = effectiveScope === "mine" ? "mine" : "all";
    const ukolyItems = await fetchUkolyForCalendarRange({
      fromDate,
      toDate,
      userId,
      scope: taskScope,
    });
    const asGrid: GridEvent[] = ukolyItems.map((u) => ({ ...u }));

    if (isListView) {
      listMerged = [...eventsAsGrid, ...asGrid].sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      );
    } else {
      eventsForGrid = [...eventsAsGrid, ...asGrid].sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      );
    }
  }
  if (showList && taskSearchRows) {
    const taskAsSearchRows: GridEvent[] = taskSearchRows.map((t) => ({
      id: t.id,
      title: t.order_number ? `Úkol -> zak. ${t.order_number}${t.urgent ? " ⚠" : ""}` : "Úkol",
      description: t.body,
      start_date: new Date(new Date(t.assigned_at).setHours(0, 0, 0, 0)),
      end_date: new Date(new Date(t.due_at).setHours(23, 59, 0, 0)),
      event_type: "ukol",
      color:
        t.status === "in_progress"
          ? "#F59E0B"
          : t.status === "done"
            ? "#16A34A"
            : UKOLY_CALENDAR_COLOR,
      location: null,
      deputy_id: null,
      approval_status: null,
      created_by: t.created_by,
      users: t.users_assignee,
      users_deputy: null,
      ukoly_task_id: t.id,
    }));
    searchMerged = [...eventsAsGrid, ...taskAsSearchRows].sort(
      (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );
  }

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
          <p className="mt-1 text-gray-600">Události, úkoly a termíny</p>
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
        {!isListView && <CalendarTabs scope={calendarScope} />}
        <CalendarViewToggle view={view} />
        <CalendarSearch initialQuery={searchQuery} showList={showList} />
      </div>

      {isListView ? (
        <CalendarListView
          events={listMerged}
          from={from}
          to={to}
          viewType={view as "list_mine" | "list_all"}
          eventMetaMode={view === "list_all" ? eventMetaMode : "hidden"}
        />
      ) : showList ? (
        <CalendarSearchResults
          events={searchMerged}
          searchQuery={searchQuery}
          calendarUrl={calendarUrl}
          eventMetaMode={eventMetaMode}
        />
      ) : (
        <>
          <CalendarNav view={view as "week" | "month"} from={from} to={to} month={month} />
          {view === "month" && month ? (
            <MonthCalendarGrid
              events={eventsForGrid}
              holidays={holidays}
              month={month}
              userId={userId}
              eventMetaMode={eventMetaMode}
            />
          ) : (
            <WeekCalendarGrid
              events={eventsForGrid}
              holidays={holidays}
              from={from}
              to={to}
              userId={userId}
              eventMetaMode={eventMetaMode}
            />
          )}
        </>
      )}
    </>
  );
}
