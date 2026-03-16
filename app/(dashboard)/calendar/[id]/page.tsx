import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ArrowLeft } from "lucide-react";

export default async function CalendarEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = parseInt((await params).id, 10);
  if (isNaN(id)) notFound();

  const event = await prisma.calendar_events.findUnique({
    where: { id },
    include: {
      users: { select: { first_name: true, last_name: true } },
      departments: { select: { name: true } },
    },
  });

  if (!event) notFound();

  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const formatTime = (d: Date) =>
    new Date(d).toLocaleTimeString("cs-CZ", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
          <p className="mt-1 text-gray-600">Detail události</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/calendar/${id}/edit`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Upravit
          </Link>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Datum</p>
            <p className="font-medium">{formatDate(event.start_date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Čas</p>
            <p className="font-medium">
              {formatTime(event.start_date)} – {formatTime(event.end_date)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Typ</p>
            <p>
              <span
                className="rounded px-2 py-0.5 text-sm"
                style={{
                  backgroundColor: `${event.color}20`,
                  color: event.color ?? "#DC2626",
                }}
              >
                {event.event_type ?? "událost"}
              </span>
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Vytvořil</p>
            <p className="font-medium">
              {event.users
                ? `${event.users.first_name} ${event.users.last_name}`
                : "-"}
            </p>
          </div>
          {event.location && (
            <div className="sm:col-span-2">
              <p className="text-sm text-gray-500">Místo</p>
              <p className="font-medium">{event.location}</p>
            </div>
          )}
          {event.description && (
            <div className="sm:col-span-2">
              <p className="text-sm text-gray-500">Popis</p>
              <p className="whitespace-pre-wrap">{event.description}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
