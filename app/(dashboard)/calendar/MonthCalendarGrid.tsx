"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  formatMonth,
} from "./lib/month-utils";
import { CreateEventModal } from "./CreateEventModal";
import { WEEKDAY_NAMES_MONDAY } from "./lib/week-utils";
import {
  getMonthGridDayYmds,
  pragueDayEnd,
  pragueDayStart,
  pragueTodayYmd,
} from "@/lib/datetime-cz";
import { timedEventOverlapsDay } from "@/lib/calendar-week-slice";
import type { Holiday } from "./lib/holidays";
import { calendarGridItemHref, calendarGridItemKey } from "@/lib/calendar-item-href";
import { isAllDayEvent, allDayEventDisplayDates } from "./lib/event-types";
import {
  buildCalendarGlobalOwnerBlock,
  buildEventMetaLines,
  calendarEventTooltipTitle,
  getCalendarEventPrimaryLabel,
  type CalendarEventMetaMode,
} from "@/lib/calendar-event-meta";
import { CalendarGlobalEventBlock } from "./CalendarGlobalEventBlock";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type CalendarEvent = {
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
};

type Props = {
  events: CalendarEvent[];
  holidays?: Holiday[];
  month: string;
  userId?: number;
  eventMetaMode?: CalendarEventMetaMode;
};

function eventMetaPrimaryLine(e: CalendarEvent, eventMetaMode: CalendarEventMetaMode): string | null {
  if (eventMetaMode === "hidden" || e.ukoly_task_id != null) return null;
  const extra = buildEventMetaLines(
    {
      users: e.users,
      users_deputy: e.users_deputy,
      deputy_id: e.deputy_id,
      approval_status: e.approval_status,
      calendar_approvals: e.calendar_approvals,
      ukoly_task_id: e.ukoly_task_id,
    },
    eventMetaMode
  );
  return extra[0] ?? null;
}

function formatDayHeading(dayYmd: string): string {
  const d = pragueDayStart(dayYmd);
  return d.toLocaleDateString("cs-CZ", {
    timeZone: "Europe/Prague",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function renderMonthDayEventBlocks(
  dayYmd: string,
  dayEvents: CalendarEvent[],
  eventMetaMode: CalendarEventMetaMode
): React.ReactNode[] {
  return dayEvents.flatMap((e) => {
    const line = e.color ?? "#DC2626";
    const isGlobal = eventMetaMode !== "hidden";

    if (isGlobal && e.ukoly_task_id == null) {
      const start = new Date(e.start_date);
      const end = new Date(e.end_date);
      const allDay = isAllDayEvent(start, end);
      const ownerLines = buildCalendarGlobalOwnerBlock(e, { allDay });
      return [
        <CalendarGlobalEventBlock
          key={`${calendarGridItemKey(e)}-${dayYmd}-owner`}
          lines={ownerLines}
          color={line}
          href={calendarGridItemHref(e)}
          title={calendarEventTooltipTitle(e, eventMetaMode)}
          compact
          onClick={(ev) => ev.stopPropagation()}
          className="w-full"
        />,
      ];
    }

    const primaryMeta = eventMetaPrimaryLine(e, eventMetaMode);
    const pendingApproval = e.approval_status === "pending" && e.deputy_id;
    const deputyApproved = e.approval_status === "deputy_approved";
    const isApproved = e.approval_status === "approved";
    return [
      <Link
        key={`${calendarGridItemKey(e)}-${dayYmd}`}
        href={calendarGridItemHref(e)}
        onClick={(ev) => ev.stopPropagation()}
        title={calendarEventTooltipTitle(e, eventMetaMode)}
        className="block w-full min-h-[1.4rem] truncate border-l-4 pl-0.5 pr-0.5 py-0.5 text-left text-[10px] font-medium leading-tight hover:opacity-90"
        style={{
          borderLeftColor: line,
          backgroundColor: `${line}20`,
          color: line,
        }}
      >
        <span className="block truncate">{getCalendarEventPrimaryLabel(e)}</span>
        {primaryMeta && (
          <span className="block truncate text-[9px] font-normal leading-tight opacity-80">
            {primaryMeta}
          </span>
        )}
        {pendingApproval && (
          <span className="ml-0.5 rounded bg-amber-500/80 px-0.5 text-white">!</span>
        )}
        {deputyApproved && (
          <span className="ml-0.5 rounded bg-blue-600 px-0.5 text-white">•</span>
        )}
        {isApproved && <span className="ml-0.5 rounded bg-red-600 px-0.5 text-white">✓</span>}
      </Link>,
    ];
  });
}

function overflowEventsTooltip(events: CalendarEvent[]): string {
  return events
    .map((e) => getCalendarEventPrimaryLabel(e))
    .join("\n");
}

export function MonthCalendarGrid({
  events,
  holidays = [],
  month,
  userId = 0,
  eventMetaMode = "hidden",
}: Props) {
  const monthDate = useMemo(() => new Date(month + "-01"), [month]);
  const todayYmd = useMemo(() => pragueTodayYmd(), []);

  const [modal, setModal] = useState<{
    start: Date;
    end: Date;
    allDay: boolean;
  } | null>(null);

  const dayYmds = useMemo(() => getMonthGridDayYmds(month), [month]);

  const weeks = useMemo(() => {
    const result: string[][] = [];
    for (let i = 0; i < dayYmds.length; i += 7) {
      result.push(dayYmds.slice(i, i + 7));
    }
    return result;
  }, [dayYmds]);

  const eventsForDay = (dayYmd: string) => {
    return events.filter((e) => {
      const start = new Date(e.start_date);
      const end = new Date(e.end_date);
      if (isAllDayEvent(start, end)) {
        return allDayEventDisplayDates(start, end).includes(dayYmd);
      }
      return timedEventOverlapsDay(start, end, dayYmd);
    });
  };

  const holidaysForDay = (dayYmd: string) =>
    holidays.filter((h) => h.date === dayYmd);

  const handleDayClick = (dayYmd: string) => {
    setModal({
      start: pragueDayStart(dayYmd),
      end: pragueDayEnd(dayYmd),
      allDay: true,
    });
  };

  const isCurrentMonth = (dayYmd: string) => dayYmd.startsWith(`${month}-`);

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="min-w-[600px]">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-center font-semibold text-gray-900">
            {formatMonth(monthDate)}
          </div>

          {/* Hlavičky dnů */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {WEEKDAY_NAMES_MONDAY.map((name) => (
              <div
                key={name}
                className="border-r border-gray-200 bg-gray-50 p-2 text-center text-xs font-medium text-gray-600 last:border-r-0"
              >
                {name}
              </div>
            ))}
          </div>

          {/* Týdny */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid min-h-[100px] grid-cols-7">
              {week.map((dayYmd) => {
                const dayEvents = eventsForDay(dayYmd);
                const dayHolidays = holidaysForDay(dayYmd);
                const isToday = dayYmd === todayYmd;
                const inMonth = isCurrentMonth(dayYmd);
                const isHoliday = dayHolidays.length > 0;
                const dayNum = parseInt(dayYmd.slice(8, 10), 10);

                return (
                  <div
                    key={dayYmd}
                    onClick={() => handleDayClick(dayYmd)}
                    className={`cursor-pointer border-r border-b border-gray-200 p-1 transition-colors last:border-r-0 hover:bg-[var(--accent)]/45 ${
                      !inMonth ? "bg-gray-50/50" : ""
                    } ${isToday ? "bg-amber-50" : ""} ${isHoliday && inMonth ? "bg-slate-50/70" : ""}`}
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded text-sm ${
                        isToday
                          ? "bg-red-600 font-bold text-white"
                          : inMonth
                            ? "text-gray-900"
                            : "text-gray-400"
                      }`}
                    >
                      {dayNum}
                    </span>
                    {dayHolidays.map((h) => (
                      <div
                        key={h.date + h.name}
                        className="mt-0.5 truncate rounded bg-slate-100 px-1 py-0.5 text-[9px] font-medium text-slate-600"
                        title={h.name}
                      >
                        {h.name}
                      </div>
                    ))}
                    <div className="mt-1 space-y-0.5">
                      {renderMonthDayEventBlocks(dayYmd, dayEvents.slice(0, 3), eventMetaMode)}
                      {dayEvents.length > 3 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              onClick={(ev) => ev.stopPropagation()}
                              title={`${overflowEventsTooltip(dayEvents.slice(3))}\n\nKlikněte pro zobrazení`}
                              className="block w-full truncate rounded px-1 text-left text-[10px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            >
                              +{dayEvents.length - 3} dalších
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-80 border border-gray-200 bg-white p-3 shadow-lg"
                            onClick={(ev) => ev.stopPropagation()}
                            onOpenAutoFocus={(ev) => ev.preventDefault()}
                          >
                            <p className="mb-2 text-sm font-semibold capitalize text-gray-900">
                              {formatDayHeading(dayYmd)}
                            </p>
                            <div className="max-h-72 space-y-1 overflow-y-auto">
                              {renderMonthDayEventBlocks(dayYmd, dayEvents, eventMetaMode)}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <CreateEventModal
          open
          onClose={() => setModal(null)}
          initialStart={modal.start}
          initialEnd={modal.end}
          allDay={modal.allDay}
        />
      )}
    </>
  );
}
