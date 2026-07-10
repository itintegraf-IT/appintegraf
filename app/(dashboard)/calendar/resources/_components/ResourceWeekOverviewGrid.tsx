"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ResourceType } from "@/lib/resource-reservation-types";
import { reservationStatusLabel } from "@/lib/resource-reservation-types";
import { formatDateLocal, parseDateLocal } from "../../lib/week-utils";
import {
  formatTimeRange,
  getWeekDayStrings,
  reservationOnDay,
} from "./resource-grid-utils";
import { ResourceBookingModal } from "./ResourceBookingModal";
import type { ReservationRow, ResourceRow } from "./ResourceWeekGrid";

type Props = {
  weekStart: Date;
  resources: ResourceRow[];
  reservations: ReservationRow[];
  resourceType: ResourceType;
  basePath: string;
};

type ModalState = {
  resourceId: number;
  resourceName: string;
  start: Date;
  end: Date;
} | null;

const WEEKDAY_LABELS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

export function ResourceWeekOverviewGrid({
  weekStart,
  resources,
  reservations,
  resourceType,
  basePath,
}: Props) {
  const router = useRouter();
  const weekDays = getWeekDayStrings(weekStart);
  const todayYmd = formatDateLocal(new Date());
  const [modal, setModal] = useState<ModalState>(null);

  const openDayView = (dayYmd: string) => {
    router.push(`${basePath}?view=day&day=${dayYmd}`);
  };

  const openBooking = (resource: ResourceRow, dayYmd: string) => {
    const start = new Date(`${dayYmd}T09:00:00`);
    const end = new Date(`${dayYmd}T10:00:00`);
    setModal({
      resourceId: resource.id,
      resourceName: resource.name,
      start,
      end,
    });
  };

  if (resources.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
        Zatím nejsou definované žádné {resourceType === "room" ? "místnosti" : "auta"}.
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-6 rounded border border-green-600 bg-green-100" /> Schváleno
        </span>
        {resourceType === "vehicle" && (
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-6 rounded border border-amber-500 bg-amber-100" /> Čeká na
            schválení
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="sticky left-0 z-10 min-w-[140px] border-r border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-600">
                Zdroj
              </th>
              {weekDays.map((dayYmd, idx) => {
                const d = parseDateLocal(dayYmd);
                const isToday = dayYmd === todayYmd;
                return (
                  <th
                    key={dayYmd}
                    className={`min-w-[120px] border-r border-gray-200 px-2 py-2 text-center last:border-r-0 ${
                      isToday ? "bg-amber-50" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => openDayView(dayYmd)}
                      className="w-full font-semibold text-gray-900 hover:text-red-600"
                      title="Otevřít denní mřížku"
                    >
                      {WEEKDAY_LABELS[idx]}
                    </button>
                    <button
                      type="button"
                      onClick={() => openDayView(dayYmd)}
                      className="mt-0.5 block w-full text-[10px] font-normal text-gray-500 hover:text-red-600"
                    >
                      {d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" })}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {resources.map((resource) => (
              <tr key={resource.id} className="border-b border-gray-100 align-top">
                <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-2 py-2 font-medium text-gray-900">
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: resource.color ?? "#2563EB" }}
                  />
                  {resource.name}
                </td>
                {weekDays.map((dayYmd) => {
                  const dayReservations = reservations.filter(
                    (r) => r.resource_id === resource.id && reservationOnDay(r, dayYmd)
                  );
                  const isToday = dayYmd === todayYmd;
                  return (
                    <td
                      key={`${resource.id}-${dayYmd}`}
                      className={`border-r border-gray-100 p-1 last:border-r-0 ${
                        isToday ? "bg-amber-50/50" : ""
                      } ${dayReservations.length === 0 ? "cursor-pointer hover:bg-red-50/40" : ""}`}
                      onClick={
                        dayReservations.length === 0
                          ? () => openBooking(resource, dayYmd)
                          : undefined
                      }
                      title={
                        dayReservations.length === 0
                          ? "Kliknutím vytvořit rezervaci"
                          : undefined
                      }
                    >
                      <div className="min-h-[4rem] space-y-1">
                        {dayReservations.map((hit) => {
                          const pending = hit.approval_status === "pending";
                          const color = resource.color ?? "#2563EB";
                          const detailHref =
                            resourceType === "vehicle"
                              ? `/calendar/resources/vehicles/${hit.id}`
                              : undefined;
                          const chip = (
                            <div
                              className={`rounded px-1 py-0.5 text-[10px] leading-tight ${
                                pending ? "border border-dashed border-amber-500 bg-amber-50" : ""
                              }`}
                              style={
                                pending
                                  ? { color: "#92400e" }
                                  : {
                                      borderLeft: `3px solid ${color}`,
                                      backgroundColor: `${color}18`,
                                      color,
                                    }
                              }
                            >
                              <span className="block truncate font-medium">{hit.title}</span>
                              <span className="block truncate opacity-80">
                                {formatTimeRange(hit.start_date, hit.end_date)}
                              </span>
                              {resourceType === "vehicle" && (
                                <span className="block truncate text-[9px] opacity-80">
                                  {reservationStatusLabel(
                                    hit.approval_status as "approved" | "pending" | "rejected"
                                  )}
                                </span>
                              )}
                            </div>
                          );
                          return detailHref ? (
                            <Link
                              key={hit.id}
                              href={detailHref}
                              className="block hover:opacity-90"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {chip}
                            </Link>
                          ) : (
                            <div key={hit.id}>{chip}</div>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <ResourceBookingModal
          open
          onClose={() => setModal(null)}
          resourceId={modal.resourceId}
          resourceName={modal.resourceName}
          resourceType={resourceType}
          initialStart={modal.start}
          initialEnd={modal.end}
        />
      )}
    </>
  );
}
