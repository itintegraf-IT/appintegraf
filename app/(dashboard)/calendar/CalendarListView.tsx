"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, User, Globe } from "lucide-react";
import { isAllDayEvent } from "./lib/event-types";
import { formatDateLocal } from "./lib/week-utils";

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
  calendar_event_participants?: Array<{
    users: { first_name: string; last_name: string } | null;
  }>;
};

type Props = {
  events: EventRow[];
  from: string;
  to: string;
  viewType: "list_mine" | "list_all";
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

function formatRange(from: string, to: string) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  return `${fromDate.toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" })} – ${toDate.toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" })}`;
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

export function CalendarListView({ events, from, to, viewType }: Props) {
  const searchParams = useSearchParams();

  const fromDate = new Date(from);
  const toDate = new Date(to);
  const prevFrom = new Date(fromDate);
  prevFrom.setDate(prevFrom.getDate() - 14);
  const prevTo = new Date(prevFrom);
  prevTo.setDate(prevTo.getDate() + 13);
  const nextFrom = new Date(fromDate);
  nextFrom.setDate(nextFrom.getDate() + 14);
  const nextTo = new Date(nextFrom);
  nextTo.setDate(nextTo.getDate() + 13);

  const buildUrl = (listFrom: string, listTo: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", viewType);
    p.set("list_from", listFrom);
    p.set("list_to", listTo);
    p.delete("from");
    p.delete("to");
    p.delete("month");
    return `/calendar?${p.toString()}`;
  };

  const prevUrl = buildUrl(formatDateLocal(prevFrom), formatDateLocal(prevTo));
  const nextUrl = buildUrl(formatDateLocal(nextFrom), formatDateLocal(nextTo));

  const title = viewType === "list_mine" ? "Seznam osobní" : "Seznam globální";
  const Icon = viewType === "list_mine" ? User : Globe;

  return (
    <div className="rounded-xl border-2 border-green-500 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Icon className="h-5 w-5 text-red-600" />
            {title}
          </h2>
          <span className="text-sm text-gray-500">{formatRange(from, to)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={prevUrl}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Předchozí 14 dní
          </Link>
          <Link
            href={nextUrl}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Další 14 dní
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
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
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  V tomto období nejsou žádné události.
                </td>
              </tr>
            ) : (
              events.map((e) => {
                const allDay = isAllDayEvent(new Date(e.start_date), new Date(e.end_date));
                return (
                  <tr
                    key={e.id}
                    className="border-b border-gray-100 transition-colors hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDate(e.start_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {allDay
                        ? "Celý den"
                        : `${formatTime(e.start_date)} – ${formatTime(e.end_date)}`}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/calendar/${e.id}`}
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
                      <span className="block truncate">{e.location ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/calendar/${e.id}`}
                        className="inline-flex rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                        title="Otevřít detail"
                        aria-label="Otevřít detail"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
