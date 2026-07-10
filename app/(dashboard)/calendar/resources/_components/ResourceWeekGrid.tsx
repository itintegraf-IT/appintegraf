"use client";

import { useState } from "react";
import Link from "next/link";
import type { ResourceType } from "@/lib/resource-reservation-types";
import { reservationStatusLabel } from "@/lib/resource-reservation-types";
import { RESOURCE_GRID_SLOT_MINUTES } from "@/lib/resource-reservation-types";
import {
  buildTimeSlots,
  formatTimeRange,
  reservationCoversSlot,
  slotToDate,
  addMinutesToSlot,
} from "./resource-grid-utils";
import { ResourceBookingModal } from "./ResourceBookingModal";

export type ResourceRow = {
  id: number;
  name: string;
  color: string | null;
  location: string | null;
  plate_number: string | null;
};

export type ReservationRow = {
  id: number;
  resource_id: number;
  title: string;
  purpose: string | null;
  start_date: Date | string;
  end_date: Date | string;
  approval_status: string;
  users_created: { first_name: string; last_name: string };
};

type Props = {
  day: string;
  resources: ResourceRow[];
  reservations: ReservationRow[];
  resourceType: ResourceType;
};

type ModalState = {
  resourceId: number;
  resourceName: string;
  start: Date;
  end: Date;
} | null;

export function ResourceWeekGrid({ day, resources, reservations, resourceType }: Props) {
  const slots = buildTimeSlots();
  const [modal, setModal] = useState<ModalState>(null);

  const handleSlotClick = (resource: ResourceRow, slot: string) => {
    const start = slotToDate(day, slot);
    const end = addMinutesToSlot(day, slot, RESOURCE_GRID_SLOT_MINUTES);
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
        Zatím nejsou definované žádné {resourceType === "room" ? "místnosti" : "auta"}. Požádejte
        administrátora o jejich založení.
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
              <th className="sticky left-0 z-10 w-16 border-r border-gray-200 bg-gray-50 px-2 py-2 text-left font-medium text-gray-600">
                Čas
              </th>
              {resources.map((r) => (
                <th
                  key={r.id}
                  className="min-w-[140px] border-r border-gray-200 px-2 py-2 text-left font-semibold text-gray-900 last:border-r-0"
                >
                  <span
                    className="mr-1 inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: r.color ?? "#2563EB" }}
                  />
                  {r.name}
                  {r.plate_number && (
                    <span className="mt-0.5 block text-[10px] font-normal text-gray-500">
                      {r.plate_number}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr key={slot} className="border-b border-gray-100">
                <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-2 py-1 text-gray-500">
                  {slot}
                </td>
                {resources.map((resource) => {
                  const hit = reservations.find(
                    (res) =>
                      res.resource_id === resource.id &&
                      reservationCoversSlot(res, day, slot)
                  );

                  const isSlotStart =
                    hit &&
                    (() => {
                      const slotStart = slotToDate(day, slot);
                      const slotIdx = slots.indexOf(slot);
                      if (slotIdx <= 0) return true;
                      const prevSlot = slots[slotIdx - 1];
                      return !reservationCoversSlot(hit, day, prevSlot);
                    })();

                  if (hit && !isSlotStart) {
                    return (
                      <td
                        key={`${resource.id}-${slot}`}
                        className="border-r border-gray-100 bg-gray-50/40 last:border-r-0"
                      />
                    );
                  }

                  if (hit && isSlotStart) {
                    const pending = hit.approval_status === "pending";
                    const color = resource.color ?? "#2563EB";
                    const detailHref =
                      resourceType === "vehicle"
                        ? `/calendar/resources/vehicles/${hit.id}`
                        : undefined;
                    const cell = (
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
                        <span className="block truncate opacity-70">
                          {hit.users_created.first_name} {hit.users_created.last_name}
                        </span>
                        {resourceType === "vehicle" && (
                          <span className="block truncate text-[9px]">
                            {reservationStatusLabel(
                              hit.approval_status as "approved" | "pending" | "rejected"
                            )}
                          </span>
                        )}
                      </div>
                    );
                    return (
                      <td
                        key={`${resource.id}-${slot}`}
                        className="border-r border-gray-100 p-0.5 align-top last:border-r-0"
                      >
                        {detailHref ? (
                          <Link href={detailHref} className="block hover:opacity-90">
                            {cell}
                          </Link>
                        ) : (
                          cell
                        )}
                      </td>
                    );
                  }

                  return (
                    <td
                      key={`${resource.id}-${slot}`}
                      className="cursor-pointer border-r border-gray-100 p-0 hover:bg-red-50/40 last:border-r-0"
                      onClick={() => handleSlotClick(resource, slot)}
                      title="Kliknutím vytvořit rezervaci"
                    >
                      <div className="h-6" />
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
