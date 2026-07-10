import { prisma } from "@/lib/db";
import { Building2 } from "lucide-react";
import { parseResourceScheduleParams } from "@/lib/resource-schedule-params";
import { ResourceCalendarTabs } from "../_components/ResourceCalendarTabs";
import { ResourceDayNav } from "../_components/ResourceDayNav";
import { ResourceWeekGrid } from "../_components/ResourceWeekGrid";
import { ResourceViewToggle } from "../_components/ResourceViewToggle";
import { ResourceWeekNav } from "../_components/ResourceWeekNav";
import { ResourceWeekOverviewGrid } from "../_components/ResourceWeekOverviewGrid";

const BASE_PATH = "/calendar/resources/rooms";

export default async function ResourceRoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; from?: string; view?: string }>;
}) {
  const params = await searchParams;
  const schedule = parseResourceScheduleParams(params);

  const resources = await prisma.calendar_resources.findMany({
    where: { resource_type: "room", is_active: true },
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
      calendar_resources: { resource_type: "room" },
      approval_status: { in: ["approved", "pending"] },
    },
    include: {
      users_created: { select: { first_name: true, last_name: true } },
    },
    orderBy: { start_date: "asc" },
  });

  return (
    <>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Building2 className="h-7 w-7 text-red-600" />
          Rezervace místností
        </h1>
        <p className="mt-1 text-gray-600">
          Týdenní přehled nebo denní mřížka – kliknutím na volný termín vytvoříte rezervaci
        </p>
      </div>

      <ResourceCalendarTabs />
      <ResourceViewToggle view={schedule.view} basePath={BASE_PATH} />

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
            resourceType="room"
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
            resourceType="room"
          />
        </>
      )}
    </>
  );
}
