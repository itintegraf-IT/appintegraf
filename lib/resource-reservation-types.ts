export const RESOURCE_TYPES = ["room", "vehicle"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESERVATION_STATUSES = ["approved", "pending", "rejected"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** Rezervace blokující slot (pending drží vůz). */
export const BLOCKING_RESERVATION_STATUSES: ReservationStatus[] = ["approved", "pending"];

export const VEHICLE_MANAGER_ROLE = "sprava_vozidel";

export const RESOURCE_GRID_START_HOUR = 7;
export const RESOURCE_GRID_END_HOUR = 18;
export const RESOURCE_GRID_SLOT_MINUTES = 30;

export function resourceTypeLabel(type: ResourceType): string {
  return type === "room" ? "Místnost" : "Auto";
}

export function reservationStatusLabel(status: ReservationStatus): string {
  switch (status) {
    case "approved":
      return "Schváleno";
    case "pending":
      return "Čeká na schválení";
    case "rejected":
      return "Zamítnuto";
  }
}

export function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value);
}
