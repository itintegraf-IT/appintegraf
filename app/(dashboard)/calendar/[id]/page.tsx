import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { ArrowLeft } from "lucide-react";
import { getEventTypeLabel } from "../lib/event-types";
import { ApproveRejectButtons } from "../ApproveRejectButtons";
import { DeleteEventButton } from "../DeleteEventButton";

export default async function CalendarEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = parseInt((await params).id, 10);
  if (isNaN(id)) notFound();

  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;

  const event = await prisma.calendar_events.findUnique({
    where: { id },
    include: {
      users: { select: { first_name: true, last_name: true, department_id: true } },
      departments: { select: { name: true, manager_id: true } },
      users_deputy: { select: { first_name: true, last_name: true } },
      calendar_event_participants: {
        include: { users: { select: { first_name: true, last_name: true } } },
      },
    },
  });

  if (!event) notFound();

  const departmentId = event.department_id ?? event.users?.department_id ?? null;
  let managerId: number | null = event.departments?.manager_id ?? null;
  if (!managerId && departmentId) {
    const dept = await prisma.departments.findUnique({
      where: { id: departmentId },
      select: { manager_id: true },
    });
    managerId = dept?.manager_id ?? null;
  }
  const isDeputy = event.deputy_id === userId && event.approval_status === "pending";
  const isManager = managerId === userId && event.approval_status === "deputy_approved";

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
        <div className="flex flex-wrap items-center gap-2">
          {(isDeputy || isManager) && (
            <ApproveRejectButtons eventId={id} eventTitle={event.title} />
          )}
          <Link
            href={`/calendar/${id}/edit`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Upravit
          </Link>
          {event.created_by === userId && (
            <DeleteEventButton eventId={id} eventTitle={event.title} />
          )}
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
                {getEventTypeLabel(event.event_type)}
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
          {event.users_deputy && (
            <div>
              <p className="text-sm text-gray-500">Zástup</p>
              <p className="font-medium">
                {event.users_deputy.first_name} {event.users_deputy.last_name}
              </p>
            </div>
          )}
          {event.calendar_event_participants && event.calendar_event_participants.length > 0 && (
            <div className="sm:col-span-2">
              <p className="text-sm text-gray-500">Pozvaní / účastníci</p>
              <ul className="mt-1 list-inside list-disc text-gray-800">
                {event.calendar_event_participants.map((p) => (
                  <li key={p.id}>
                    {p.users
                      ? `${p.users.first_name} ${p.users.last_name}`
                      : `Uživatel #${p.user_id}`}
                    {p.status === "pending" ? <span className="ml-1 text-xs text-amber-700">(pozvánka)</span> : null}
                    {p.status === "accepted" ? <span className="ml-1 text-xs text-green-700">(potvrzeno)</span> : null}
                    {p.status === "rejected" ? <span className="ml-1 text-xs text-red-700">(zamítnuto)</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {event.approval_status && (
            <div>
              <p className="text-sm text-gray-500">Stav schválení</p>
              <p>
                <span
                  className={`rounded px-2 py-0.5 text-sm ${
                    event.approval_status === "approved"
                      ? "bg-green-100 text-green-800"
                      : event.approval_status === "rejected"
                        ? "bg-red-100 text-red-800"
                        : event.approval_status === "deputy_approved"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {event.approval_status === "approved"
                    ? "Schváleno"
                    : event.approval_status === "rejected"
                      ? "Zamítnuto"
                      : event.approval_status === "deputy_approved"
                        ? "Čeká na vedoucího"
                        : "Čeká na schválení"}
                </span>
              </p>
            </div>
          )}
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
