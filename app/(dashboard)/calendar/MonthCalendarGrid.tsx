"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getWeekStart } from "./lib/week-utils";
import {
  getMonthGridStart,
  getMonthGridEnd,
  formatMonth,
} from "./lib/month-utils";
import { CreateEventModal } from "./CreateEventModal";
import { WEEKDAY_NAMES_MONDAY, formatDateLocal } from "./lib/week-utils";
import type { Holiday } from "./lib/holidays";
import { calendarGridItemHref, calendarGridItemKey } from "@/lib/calendar-item-href";
import { isAllDayEvent, allDayEventDisplayDates } from "./lib/event-types";

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
  ukoly_task_id?: number | null;
};

type Props = {
  events: CalendarEvent[];
  holidays?: Holiday[];
  month: string;
  userId?: number;
};

export function MonthCalendarGrid({ events, holidays = [], month, userId = 0 }: Props) {
  const monthDate = useMemo(() => new Date(month + "-01"), [month]);
  const today = useMemo(() => new Date().toDateString(), []);

  const [modal, setModal] = useState<{
    start: Date;
    end: Date;
    allDay: boolean;
  } | null>(null);

  const gridStart = useMemo(() => getMonthGridStart(monthDate), [monthDate]);
  const gridEnd = useMemo(() => getMonthGridEnd(monthDate), [monthDate]);

  const days = useMemo(() => {
    const result: Date[] = [];
    const d = new Date(gridStart);
    while (d <= gridEnd) {
      result.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return result;
  }, [gridStart, gridEnd]);

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  const eventsForDay = (day: Date) => {
    const dayKey = formatDateLocal(day);
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    return events.filter((e) => {
      const start = new Date(e.start_date);
      const end = new Date(e.end_date);
      if (isAllDayEvent(start, end)) {
        return allDayEventDisplayDates(start, end).includes(dayKey);
      }
      return start <= dayEnd && end >= dayStart;
    });
  };

  const holidaysForDay = (day: Date) =>
    holidays.filter((h) => h.date === formatDateLocal(day));

  const handleDayClick = (day: Date) => {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 0, 0);
    setModal({ start, end, allDay: true });
  };

  const isCurrentMonth = (day: Date) =>
    day.getMonth() === monthDate.getMonth();

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
              {week.map((day) => {
                const dayEvents = eventsForDay(day);
                const dayHolidays = holidaysForDay(day);
                const isToday = day.toDateString() === today;
                const inMonth = isCurrentMonth(day);
                const isHoliday = dayHolidays.length > 0;

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => handleDayClick(day)}
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
                      {day.getDate()}
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
                      {dayEvents.slice(0, 3).map((e) => {
                        const line = e.color ?? "#DC2626";
                        const pendingApproval =
                          e.approval_status === "pending" && e.deputy_id;
                        const deputyApproved =
                          e.approval_status === "deputy_approved";
                        const isApproved = e.approval_status === "approved";
                        return (
                          <Link
                            key={`${calendarGridItemKey(e)}-${day.toDateString()}`}
                            href={calendarGridItemHref(e)}
                            onClick={(ev) => ev.stopPropagation()}
                            className="block w-full min-h-[1.4rem] truncate border-l-4 pl-0.5 pr-0.5 py-0.5 text-left text-[10px] font-medium leading-tight hover:opacity-90"
                            style={{
                              borderLeftColor: line,
                              backgroundColor: `${line}20`,
                              color: line,
                            }}
                          >
                            {e.title}
                            {pendingApproval && (
                              <span className="ml-0.5 rounded bg-amber-500/80 px-0.5 text-white">
                                !
                              </span>
                            )}
                            {deputyApproved && (
                              <span className="ml-0.5 rounded bg-blue-600 px-0.5 text-white">
                                •
                              </span>
                            )}
                            {isApproved && (
                              <span className="ml-0.5 rounded bg-red-600 px-0.5 text-white">
                                ✓
                              </span>
                            )}
                          </Link>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span className="block truncate px-1 text-[10px] text-gray-500">
                          +{dayEvents.length - 3} dalších
                        </span>
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
