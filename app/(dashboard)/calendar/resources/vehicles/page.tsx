import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isVehicleManager } from "@/lib/resource-reservation-access";
import { parseResourceScheduleParams } from "@/lib/resource-schedule-params";
import { Car } from "lucide-react";
import Link from "next/link";
import { ResourceCalendarTabs } from "../_components/ResourceCalendarTabs";
import { ResourceDayNav } from "../_components/ResourceDayNav";
import { ResourceWeekGrid } from "../_components/ResourceWeekGrid";
import { ResourceViewToggle } from "../_components/ResourceViewToggle";
import { ResourceWeekNav } from "../_components/ResourceWeekNav";
import { ResourceWeekOverviewGrid } from "../_components/ResourceWeekOverviewGrid";

const BASE_PATH = "/calendar/resources/vehicles";

export default async function ResourceVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; from?: string; view?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  const params = await searchParams;
  const schedule = parseResourceScheduleParams(params);

  const resources = await prisma.calendar_resources.findMany({
    where: { resource_type: "vehicle", is_active: true },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      location: true,
      plate_number: true,
    },
  });

  const reservations = await prisma.resource_reservations.findMany({
    where: {
      start_date: {
        lte: new Date(
          schedule.view === "week" ? `${schedule.weekTo}T23:59:59` : `${schedule.day}T23:59:59`
        ),
      },
      end_date: {
        gte: new Date(
          schedule.view === "week" ? `${schedule.weekFrom}T00:00:00` : `${schedule.day}T00:00:00`
        ),
      },
      calendar_resources: { resource_type: "vehicle" },
      approval_status: { in: ["approved", "pending"] },
    },
    include: {
      users_created: { select: { first_name: true, last_name: true } },
    },
    orderBy: { start_date: "asc" },
  });

  const pendingForMe =
    userId > 0 && (await isVehicleManager(userId))
      ? await prisma.resource_reservations.findMany({
          where: {
            approval_status: "pending",
            assigned_approver_id: userId,
          },
          include: {
            calendar_resources: { select: { name: true } },
            users_created: { select: { first_name: true, last_name: true } },
          },
          orderBy: { start_date: "asc" },
          take: 10,
        })
      : [];

  return (
    <>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Car className="h-7 w-7 text-red-600" />
          Rezervace aut
        </h1>
        <p className="mt-1 text-gray-600">
          Týdenní přehled nebo denní mřížka. Rezervace vyžaduje schválení správcem vozidel.
        </p>
      </div>

      <ResourceCalendarTabs />
      <ResourceViewToggle view={schedule.view} basePath={BASE_PATH} />

      {pendingForMe.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 font-semibold text-amber-900">Ke schválení ({pendingForMe.length})</h2>
          <ul className="space-y-2 text-sm">
            {pendingForMe.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/calendar/resources/vehicles/${r.id}`}
                  className="text-red-700 hover:underline"
                >
                  {r.title} – {r.calendar_resources.name} (
                  {r.users_created.first_name} {r.users_created.last_name})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {schedule.view === "week" ? (
        <>
          <ResourceWeekNav
            weekFrom={schedule.weekFrom}
            weekTo={schedule.weekTo}
            basePath={BASE_PATH}
          />
          <ResourceWeekOverviewGrid
            weekStart={schedule.weekStart}
            resources={resources}
            reservations={reservations}
            resourceType="vehicle"
            basePath={BASE_PATH}
          />
        </>
      ) : (
        <>
          <ResourceDayNav day={schedule.day} basePath={BASE_PATH} />
          <ResourceWeekGrid
            day={schedule.day}
            resources={resources}
            reservations={reservations}
            resourceType="vehicle"
          />
        </>
      )}
    </>
  );
}
