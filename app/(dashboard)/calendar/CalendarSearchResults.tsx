"use client";

import Link from "next/link";
import { CalendarRange, ExternalLink } from "lucide-react";
import { isAllDayEvent } from "./lib/event-types";
import { calendarGridItemHref, calendarGridItemKey } from "@/lib/calendar-item-href";

type EventRow = {
  id: number;
  title: string;
  description: string | null;
  start_date: Date;
  end_date: Date;
  location: string | null;
  color: string | null;
  users: { first_name: string; last_name: string } | null;
  users_deputy: { first_name: string; last_name: string } | null;
  ukoly_task_id?: number | null;
  calendar_event_participants?: Array<{
    users: { first_name: string; last_name: string } | null;
  }>;
};

type Props = {
  events: EventRow[];
  searchQuery: string;
  calendarUrl: string;
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(d: Date) {
  return new Date(d).toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPeopleNames(event: EventRow): string {
  const names: string[] = [];
  if (event.users) {
    names.push(`${event.users.first_name} ${event.users.last_name}`);
  }
  if (event.users_deputy) {
    names.push(`${event.users_deputy.first_name} ${event.users_deputy.last_name} (zástup)`);
  }
  const participants = event.calendar_event_participants ?? [];
  for (const p of participants) {
    if (p.users) {
      const n = `${p.users.first_name} ${p.users.last_name}`;
      if (!names.includes(n)) names.push(n);
    }
  }
  return names.join(", ") || "—";
}

export function CalendarSearchResults({
  events,
  searchQuery,
  calendarUrl,
}: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border-2 border-green-500 bg-white p-8 text-center shadow-sm">
        <p className="text-gray-600">
          Pro hledání „<strong>{searchQuery}</strong>“ nebyly nalezeny žádné položky.
        </p>
        <Link
          href={calendarUrl}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <CalendarRange className="h-4 w-4" />
          Zobrazit kalendář
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-green-500 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-sm text-gray-600">
          Nalezeno <strong>{events.length}</strong> položek pro „<strong>{searchQuery}</strong>“
        </p>
        <Link
          href={calendarUrl}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <CalendarRange className="h-4 w-4" />
          Zobrazit v kalendáři
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Datum
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Čas
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Název
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Lidé
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Místo
              </th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const allDay = isAllDayEvent(new Date(e.start_date), new Date(e.end_date));
              return (
                <tr
                  key={calendarGridItemKey(e)}
                  className="border-b border-gray-100 transition-colors hover:bg-gray-50/50"
                >
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {formatDate(e.start_date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {allDay ? "Celý den" : `${formatTime(e.start_date)} – ${formatTime(e.end_date)}`}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={calendarGridItemHref(e)}
                      className="font-medium text-red-600 hover:underline"
                      style={{ color: e.color ?? "#DC2626" }}
                    >
                      {e.title}
                    </Link>
                    {e.description && (
                      <p className="mt-0.5 max-w-[200px] truncate text-xs text-gray-500">
                        {e.description}
                      </p>
                    )}
                  </td>
                  <td className="max-w-[180px] px-4 py-3 text-sm text-gray-600">
                    <span className="line-clamp-2">{getPeopleNames(e)}</span>
                  </td>
                  <td className="max-w-[120px] px-4 py-3 text-sm text-gray-600">
                    <span className="truncate block">{e.location ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={calendarGridItemHref(e)}
                      className="inline-flex rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                      title="Otevřít detail"
                      aria-label="Otevřít detail"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
