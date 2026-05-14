"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { parseDateLocal, formatDateLocal } from "./lib/week-utils";
import type { Holiday } from "./lib/holidays";
import { isAllDayEvent, allDayEventDisplayDates, requiresDeputy } from "./lib/event-types";
import { CreateEventModal } from "./CreateEventModal";
import { ConfirmMoveModal } from "./ConfirmMoveModal";
import { calendarGridItemHref, calendarGridItemKey } from "@/lib/calendar-item-href";
import {
  buildEventMetaLines,
  type CalendarEventMetaMode,
} from "@/lib/calendar-event-meta";

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
  from: string;
  to: string;
  userId?: number;
  /** Globální kalendář: vlastník, zástup; u Vedení navíc schválení vedoucím */
  eventMetaMode?: CalendarEventMetaMode;
};

function EventMetaSubtext({
  e,
  mode,
}: {
  e: CalendarEvent;
  mode: CalendarEventMetaMode;
}) {
  if (mode === "hidden") return null;
  const lines = buildEventMetaLines(
    {
      users: e.users,
      users_deputy: e.users_deputy,
      deputy_id: e.deputy_id,
      approval_status: e.approval_status,
      calendar_approvals: e.calendar_approvals,
      ukoly_task_id: e.ukoly_task_id,
    },
    mode
  );
  if (lines.length === 0) return null;
  return (
    <span className="mt-0.5 block w-full text-[9px] font-normal normal-case leading-tight text-gray-600">
      {lines.map((l, i) => (
        <span key={i} className="block truncate">
          {l}
        </span>
      ))}
    </span>
  );
}

const ROW_HEIGHT = 32;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
/** Mřížka = 24 řádků (0–23), celková výška v px – nic nesmí přesáhnout */
const DAY_GRID_HEIGHT = 24 * ROW_HEIGHT;

/** Vypočítá top a height pro daný den – výška je vždy oříznutá na konec dne (24 hodin). */
function getEventSliceForDay(
  event: CalendarEvent,
  day: Date,
  options?: { onlyFirstDayOfMultiDay?: boolean }
): { top: number; height: number } | null {
  const start = new Date(event.start_date);
  const end = new Date(event.end_date);

  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  const startDayStr = formatDateLocal(start);
  const endDayStr = formatDateLocal(end);
  const dayStr = formatDateLocal(day);

  if (options?.onlyFirstDayOfMultiDay && startDayStr !== endDayStr) {
    if (dayStr !== startDayStr) return null;
  }

  if (end <= dayStart || start >= dayEnd) return null;

  const sliceStart = start < dayStart ? dayStart : start;
  const sliceEnd = end > dayEnd ? dayEnd : end;

  const top =
    (sliceStart.getHours() + sliceStart.getMinutes() / 60) * ROW_HEIGHT;
  const durationHours =
    (sliceEnd.getTime() - sliceStart.getTime()) / (60 * 60 * 1000);
  let height = Math.max(18, durationHours * ROW_HEIGHT);

  /** Nikdy nepřetéct pod řádek 23 (den = přesně 24 hodin od 0:00 do 23:59) */
  const maxHeight = DAY_GRID_HEIGHT - top;
  height = Math.min(height, maxHeight);

  return { top, height };
}

/** Jemné zabarvení sloupce (hlavička / celý den / 0–23) podle první celodenní události v daném dni. */
function cellAllDayShadeStyle(
  accent: string | undefined,
  isToday: boolean,
  isHoliday: boolean
): CSSProperties {
  if (accent) {
    const base = isToday
      ? "rgb(255, 250, 235)"
      : isHoliday
        ? "rgb(241, 245, 249)"
        : "rgb(255, 255, 255)";
    return {
      backgroundColor: `color-mix(in srgb, ${accent} 18%, ${base})`,
      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 22%, transparent)`,
    };
  }
  if (isToday) return { backgroundColor: "rgba(255, 250, 235, 0.5)" };
  if (isHoliday) return { backgroundColor: "rgb(241, 245, 249)" };
  return { backgroundColor: "rgb(249, 250, 251)" };
}

export function WeekCalendarGrid({
  events,
  holidays = [],
  from,
  to,
  userId = 0,
  eventMetaMode = "hidden",
}: Props) {
  const router = useRouter();
  const weekStart = useMemo(() => {
    const d = parseDateLocal(from);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [from]);
  const today = useMemo(() => new Date().toDateString(), []);
  const [modal, setModal] = useState<{
    start: Date;
    end: Date;
    allDay: boolean;
  } | null>(null);
  const [moveModal, setMoveModal] = useState<{
    eventId: number;
    eventTitle: string;
    newStart: Date;
    newEnd: Date;
    allDay: boolean;
    requiresApproval: boolean;
  } | null>(null);

  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    if (event.ukoly_task_id != null) return;
    if (event.created_by !== userId) return;
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        id: event.id,
        start: event.start_date,
        end: event.end_date,
        allDay: isAllDayEvent(new Date(event.start_date), new Date(event.end_date)),
        event_type: event.event_type,
        deputy_id: event.deputy_id,
      })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, day: Date, hour?: number) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    let data: { id: number; start: string; end: string; allDay: boolean; event_type: string | null; deputy_id: number | null };
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    const event = events.find((ev) => ev.id === data.id);
    if (!event || event.created_by !== userId) return;

    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    let newStart: Date;
    let newEnd: Date;
    const allDay = data.allDay;

    if (allDay) {
      newStart = new Date(dayStart);
      const oldStart = new Date(data.start);
      const oldEnd = new Date(data.end);
      const durationDays = Math.round((oldEnd.getTime() - oldStart.getTime()) / (24 * 60 * 60 * 1000)) || 1;
      newEnd = new Date(dayStart);
      newEnd.setDate(newEnd.getDate() + durationDays);
      newEnd.setHours(23, 59, 59, 999);
    } else {
      const h = hour ?? 0;
      newStart = new Date(day);
      newStart.setHours(h, 0, 0, 0);
      const oldStart = new Date(data.start);
      const oldEnd = new Date(data.end);
      const durationMs = oldEnd.getTime() - oldStart.getTime();
      newEnd = new Date(newStart.getTime() + durationMs);
    }

    setMoveModal({
      eventId: event.id,
      eventTitle: event.title,
      newStart,
      newEnd,
      allDay,
      requiresApproval: !!event.deputy_id && requiresDeputy(event.event_type),
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleCellClick = (day: Date, hour: number) => {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(hour + 1, 0, 0, 0);
    setModal({ start, end, allDay: false });
  };

  const handleAllDayClick = (day: Date) => {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 0, 0);
    setModal({ start, end, allDay: true });
  };

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const allDayEvents = useMemo(() => {
    return events.filter(
      (e) =>
        e.ukoly_task_id != null ||
        isAllDayEvent(new Date(e.start_date), new Date(e.end_date))
    );
  }, [events]);

  const ukolyRangeEvents = useMemo(() => {
    const weekStartDate = new Date(weekStart);
    weekStartDate.setHours(0, 0, 0, 0);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    weekEndDate.setHours(23, 59, 59, 999);

    return allDayEvents
      .filter((e) => e.ukoly_task_id != null)
      .map((e) => {
        const start = new Date(e.start_date);
        const end = new Date(e.end_date);
        const clippedStart = start < weekStartDate ? weekStartDate : start;
        const clippedEnd = end > weekEndDate ? weekEndDate : end;
        const startIdx = Math.max(
          0,
          Math.min(6, Math.floor((clippedStart.getTime() - weekStartDate.getTime()) / (24 * 60 * 60 * 1000)))
        );
        const endIdx = Math.max(
          0,
          Math.min(6, Math.floor((clippedEnd.getTime() - weekStartDate.getTime()) / (24 * 60 * 60 * 1000)))
        );
        return {
          e,
          startIdx,
          endIdx,
          startsInThisWeek: start >= weekStartDate && start <= weekEndDate,
          endsInThisWeek: end >= weekStartDate && end <= weekEndDate,
        };
      })
      .filter((x) => x.endIdx >= x.startIdx);
  }, [allDayEvents, weekStart]);

  const timedEvents = useMemo(() => {
    return events.filter(
      (e) =>
        e.ukoly_task_id == null &&
        !isAllDayEvent(new Date(e.start_date), new Date(e.end_date))
    );
  }, [events]);

  /** Barva pro zvýraznění sloupce (pouze běžné celodenní, ne úkoly) */
  const allDayColumnAccent = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of days) {
      const key = formatDateLocal(d);
      for (const e of allDayEvents) {
        if (e.ukoly_task_id != null) continue;
        const s = new Date(e.start_date);
        const en = new Date(e.end_date);
        if (allDayEventDisplayDates(s, en).includes(key)) {
          m.set(key, e.color ?? "#DC2626");
          break;
        }
      }
    }
    return m;
  }, [allDayEvents, days]);

  const holidaysForDay = (day: Date) =>
    holidays.filter((h) => h.date === formatDateLocal(day));

  const totalHeight = 24 * ROW_HEIGHT;

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="min-w-[700px] flex flex-col">
        {/* Řádek 1: Celý den + hlavičky dnů */}
        <div className="flex border-b border-gray-200">
          <div className="w-[60px] shrink-0 border-r border-gray-200 bg-gray-50 px-2 py-2 text-xs font-medium text-gray-500">
            Celý den
          </div>
          <div className="flex flex-1">
            {days.map((d) => {
              const dayHolidays = holidaysForDay(d);
              const isHoliday = dayHolidays.length > 0;
              const dayKey = formatDateLocal(d);
              const isTod = d.toDateString() === today;
              const accent = allDayColumnAccent.get(dayKey);
              return (
                <div
                  key={d.toISOString()}
                  className={`flex-1 border-r border-gray-200 px-2 py-2 text-center text-sm font-medium last:border-r-0 ${
                    isTod
                      ? "text-amber-900"
                      : isHoliday
                        ? "text-slate-700"
                        : "text-gray-700"
                  }`}
                  style={cellAllDayShadeStyle(accent, isTod, isHoliday)}
                  title={dayHolidays.map((h) => h.name).join(", ")}
                >
                  {d.toLocaleDateString("cs-CZ", { weekday: "short" })} {d.getDate()}.{" "}
                  {d.getMonth() + 1}.
                  {isHoliday && (
                    <span className="ml-0.5 text-[10px] text-slate-500">•</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Řádek 2: Obsah Celý den */}
        <div className="flex border-b border-gray-200">
          <div className="w-[60px] shrink-0 border-r border-gray-200 bg-gray-50" />
          <div
            className="relative flex flex-1"
            style={{ minHeight: Math.max(36, ukolyRangeEvents.length * 22 + 10) }}
          >
            {days.map((d) => {
              const dayKey = formatDateLocal(d);
              const isTod = d.toDateString() === today;
              const accent = allDayColumnAccent.get(dayKey);
              return (
              <div
                key={d.toISOString()}
                onClick={() => handleAllDayClick(d)}
                onDrop={(ev) => handleDrop(ev, d)}
                onDragOver={handleDragOver}
                className="flex min-h-11 flex-1 cursor-pointer flex-col gap-1 border-r border-gray-200 px-1 py-1 align-top last:border-r-0 transition-colors hover:bg-[var(--accent)]/45"
                style={cellAllDayShadeStyle(accent, isTod, holidaysForDay(d).length > 0)}
              >
                {holidaysForDay(d).map((h) => (
                  <div
                    key={h.date + h.name}
                    className="w-full shrink-0 truncate rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                    title={h.name}
                  >
                    {h.name}
                  </div>
                ))}
                {allDayEvents
                  .filter((e) => {
                    if (e.ukoly_task_id != null) return false;
                    const start = new Date(e.start_date);
                    const end = new Date(e.end_date);
                    return allDayEventDisplayDates(start, end).includes(formatDateLocal(d));
                  })
                  .map((e) => {
                    const barColor = e.color ?? "#DC2626";
                    const pendingApproval = e.approval_status === "pending" && e.deputy_id;
                    const deputyApproved = e.approval_status === "deputy_approved";
                    const isApproved = e.approval_status === "approved";
                    const deputyName = e.users_deputy
                      ? `${e.users_deputy.first_name} ${e.users_deputy.last_name}`
                      : null;
                    const canDrag = e.created_by === userId && e.ukoly_task_id == null;
                    const eventContent = (
                      <>
                        {e.title}
                        {pendingApproval && (
                          <span className="ml-1 block text-[10px] opacity-90">
                            <span className="rounded bg-amber-500/80 px-1 py-0.5 text-white">
                              Čeká na schválení
                            </span>
                            {deputyName && eventMetaMode === "hidden" && (
                              <span className="ml-1 text-gray-600">→ {deputyName}</span>
                            )}
                          </span>
                        )}
                        {deputyApproved && (
                          <span className="ml-1 block text-[10px]">
                            <span className="rounded bg-blue-600 px-1 py-0.5 text-white">
                              Čeká na schválení
                            </span>
                          </span>
                        )}
                        {isApproved && (
                          <span className="ml-1 block text-[10px]">
                            <span className="rounded bg-red-600 px-1 py-0.5 text-white">
                              Schváleno
                            </span>
                          </span>
                        )}
                      </>
                    );
                    const barClass =
                      "w-full min-h-8 shrink-0 border-l-4 pl-2 pr-1 py-1 text-left text-xs font-medium";
                    return canDrag ? (
                      <div
                        key={calendarGridItemKey(e)}
                        draggable
                        onDragStart={(ev) => handleDragStart(ev, e)}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          router.push(calendarGridItemHref(e));
                        }}
                        className={`${barClass} block cursor-grab overflow-hidden rounded-sm hover:opacity-90 active:cursor-grabbing ${eventMetaMode === "hidden" ? "truncate" : ""}`}
                        style={{
                          borderLeftColor: barColor,
                          backgroundColor: `${barColor}20`,
                          color: barColor,
                        }}
                      >
                        {eventContent}
                        <EventMetaSubtext e={e} mode={eventMetaMode} />
                      </div>
                    ) : (
                      <Link
                        key={calendarGridItemKey(e)}
                        href={calendarGridItemHref(e)}
                        onClick={(ev) => ev.stopPropagation()}
                        className={`${barClass} block overflow-hidden rounded-sm hover:opacity-90 ${eventMetaMode === "hidden" ? "truncate" : ""}`}
                        style={{
                          borderLeftColor: barColor,
                          backgroundColor: `${barColor}20`,
                          color: barColor,
                        }}
                      >
                        {eventContent}
                        <EventMetaSubtext e={e} mode={eventMetaMode} />
                      </Link>
                    );
                  })}
              </div>
            );
            })}
            {ukolyRangeEvents.map((item, idx) => {
              const { e, startIdx, endIdx, startsInThisWeek, endsInThisWeek } = item;
              const lineColor = e.color ?? "#DC2626";
              const leftPercent = (startIdx / 7) * 100;
              const widthPercent = ((endIdx - startIdx + 1) / 7) * 100;
              const top = 4 + idx * 22;
              const showCenterLabel = !startsInThisWeek && !endsInThisWeek;
              return (
                <Link
                  key={`line-${calendarGridItemKey(e)}-${idx}`}
                  href={calendarGridItemHref(e)}
                  onClick={(ev) => ev.stopPropagation()}
                  className="absolute z-10 h-5 rounded-sm px-2 text-[11px] font-medium hover:opacity-90"
                  style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                    top,
                    color: lineColor,
                    backgroundColor: `${lineColor}1A`,
                    borderTop: `2px solid ${lineColor}`,
                  }}
                  title={e.title}
                >
                  <span className="absolute -right-1 -top-[6px]" style={{ color: lineColor }}>
                    ➜
                  </span>
                  {startsInThisWeek && <span className="truncate">{e.title}</span>}
                  {endsInThisWeek && !startsInThisWeek && <span className="float-right truncate">{e.title}</span>}
                  {showCenterLabel && <span className="mx-auto block w-fit truncate">{e.title}</span>}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Řádek 3+: Časová mřížka */}
        <div className="flex">
          <div className="w-[60px] shrink-0 border-r border-gray-200 bg-gray-50">
            {HOURS.map((h) => (
              <div
                key={h}
                className="pr-2 text-right text-xs text-gray-500"
                style={{ height: ROW_HEIGHT, lineHeight: `${ROW_HEIGHT}px` }}
              >
                {h}
              </div>
            ))}
          </div>
          <div className="flex flex-1">
            {days.map((d) => {
              const dayKey = formatDateLocal(d);
              const isTod = d.toDateString() === today;
              const accent = allDayColumnAccent.get(dayKey);
              return (
              <div
                key={d.toISOString()}
                className="relative z-0 flex-1 overflow-hidden border-r border-gray-200 last:border-r-0"
                style={{
                  minHeight: totalHeight,
                  height: totalHeight,
                  ...cellAllDayShadeStyle(accent, isTod, holidaysForDay(d).length > 0),
                }}
                onDrop={(ev) => {
                  ev.preventDefault();
                  const rect = ev.currentTarget.getBoundingClientRect();
                  const y = ev.clientY - rect.top;
                  const hour = Math.min(23, Math.max(0, Math.floor(y / ROW_HEIGHT)));
                  handleDrop(ev, d, hour);
                }}
                onDragOver={handleDragOver}
              >
                {/* Hodinové čáry - klikatelné buňky */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    onClick={() => handleCellClick(d, h)}
                    className="relative z-[1] cursor-pointer border-b border-gray-100 transition-colors hover:bg-[var(--accent)]/45"
                    style={{ height: ROW_HEIGHT }}
                  />
                ))}
                {/* Události - absolutní pozicování, vícedenní se zobrazí ve všech dnech */}
                {timedEvents
                  .map((e) => {
                    const onlyFirst =
                      requiresDeputy(e.event_type) &&
                      formatDateLocal(new Date(e.start_date)) !==
                        formatDateLocal(new Date(e.end_date));
                    const slice = getEventSliceForDay(e, d, {
                      onlyFirstDayOfMultiDay: onlyFirst,
                    });
                    if (!slice) return null;
                    const eventStart = new Date(e.start_date);
                    const dayStart = new Date(d);
                    dayStart.setHours(0, 0, 0, 0);
                    const dayEnd = new Date(d);
                    dayEnd.setHours(23, 59, 59, 999);
                    const isFirstDay = eventStart >= dayStart && eventStart <= dayEnd;
                    const pendingApproval = e.approval_status === "pending" && e.deputy_id;
                    const deputyApproved = e.approval_status === "deputy_approved";
                    const isApproved = e.approval_status === "approved";
                    const deputyName = e.users_deputy
                      ? `${e.users_deputy.first_name} ${e.users_deputy.last_name}`
                      : null;
                    const canDrag = e.created_by === userId && e.ukoly_task_id == null;
                    const timedEventContent = (
                      <>
                        <span className="block truncate">
                          {e.title}
                          {pendingApproval && (
                            <span className="ml-1 inline-block rounded bg-amber-500/90 px-1 text-[9px] text-white">
                              Čeká na schválení
                            </span>
                          )}
                          {deputyApproved && (
                            <span className="ml-1 inline-block rounded bg-blue-600 px-1 text-[9px] text-white">
                              Čeká na schválení
                            </span>
                          )}
                          {isApproved && (
                            <span className="ml-1 inline-block rounded bg-red-600 px-1 text-[9px] text-white">
                              Schváleno
                            </span>
                          )}
                        </span>
                        {pendingApproval && deputyName && eventMetaMode === "hidden" && (
                          <span className="block truncate text-[9px] opacity-80">
                            → {deputyName}
                          </span>
                        )}
                        {isFirstDay && (
                          <span className="text-[10px] opacity-80">
                            {new Date(e.start_date).toLocaleTimeString("cs-CZ", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                        <EventMetaSubtext e={e} mode={eventMetaMode} />
                      </>
                    );
                    const timedStyle = {
                      top: 2 + slice.top,
                      height: slice.height - 4,
                      backgroundColor: `${e.color ?? "#DC2626"}24`,
                      color: e.color ?? "#DC2626",
                      borderLeft: `3px solid ${e.color ?? "#DC2626"}`,
                    };
                    return canDrag ? (
                      <div
                        key={`${calendarGridItemKey(e)}-${d.toDateString()}`}
                        draggable
                        onDragStart={(ev) => handleDragStart(ev, e)}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          router.push(calendarGridItemHref(e));
                        }}
                        className="absolute left-1 right-1 z-10 cursor-grab overflow-hidden rounded px-2 py-0.5 text-xs font-medium hover:opacity-90 active:cursor-grabbing"
                        style={timedStyle}
                      >
                        {timedEventContent}
                      </div>
                    ) : (
                      <Link
                        key={`${calendarGridItemKey(e)}-${d.toDateString()}`}
                        href={calendarGridItemHref(e)}
                        onClick={(ev) => ev.stopPropagation()}
                        className="absolute left-1 right-1 z-10 overflow-hidden rounded px-2 py-0.5 text-xs font-medium hover:opacity-90"
                        style={timedStyle}
                      >
                        {timedEventContent}
                      </Link>
                    );
                  })
                  .filter(Boolean)}
              </div>
            );
            })}
          </div>
        </div>
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

      {moveModal && (
        <ConfirmMoveModal
          eventId={moveModal.eventId}
          eventTitle={moveModal.eventTitle}
          newStart={moveModal.newStart}
          newEnd={moveModal.newEnd}
          allDay={moveModal.allDay}
          requiresApproval={moveModal.requiresApproval}
          onClose={() => setMoveModal(null)}
        />
      )}
    </>
  );
}
