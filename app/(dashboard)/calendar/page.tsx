import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth-utils";
import { Calendar, Plus, Download } from "lucide-react";
import { CalendarNav } from "./CalendarNav";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  const admin = await isAdmin(userId);

  const params = await searchParams;
  const now = new Date();
  const from = params.from ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = params.to ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  const events = await prisma.calendar_events.findMany({
    where: {
      start_date: { lte: toDate },
      end_date: { gte: fromDate },
    },
    orderBy: { start_date: "asc" },
    take: 100,
    include: {
      users: { select: { first_name: true, last_name: true } },
      departments: { select: { name: true } },
    },
  });

  const formatDate = (d: Date) => new Date(d).toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" });
  const formatTime = (d: Date) => new Date(d).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });

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

      <CalendarNav from={from} to={to} />

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Název</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Datum</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Čas</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Typ</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Místo</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Vytvořil</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Žádné události v tomto období
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/calendar/${e.id}`} className="font-medium text-gray-900 hover:text-red-600">
                        {e.title}
                      </Link>
                      {e.description && (
                        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{e.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">{formatDate(e.start_date)}</td>
                    <td className="px-4 py-3">
                      {formatTime(e.start_date)} – {formatTime(e.end_date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded px-2 py-0.5 text-sm" style={{ backgroundColor: `${e.color}20`, color: e.color ?? "#DC2626" }}>
                        {e.event_type ?? "událost"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{e.location ?? "-"}</td>
                    <td className="px-4 py-3">
                      {e.users ? `${e.users.first_name} ${e.users.last_name}` : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
