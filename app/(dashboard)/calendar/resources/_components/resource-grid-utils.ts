import {
  RESOURCE_GRID_END_HOUR,
  RESOURCE_GRID_SLOT_MINUTES,
  RESOURCE_GRID_START_HOUR,
} from "@/lib/resource-reservation-types";
import { formatDateLocal } from "../../lib/week-utils";

export function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = RESOURCE_GRID_START_HOUR; h < RESOURCE_GRID_END_HOUR; h++) {
    for (let m = 0; m < 60; m += RESOURCE_GRID_SLOT_MINUTES) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

export function slotToDate(dayYmd: string, slot: string): Date {
  return new Date(`${dayYmd}T${slot}:00`);
}

export function addMinutesToSlot(dayYmd: string, slot: string, minutes: number): Date {
  const d = slotToDate(dayYmd, slot);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

export function reservationCoversSlot(
  reservation: { start_date: Date | string; end_date: Date | string },
  dayYmd: string,
  slot: string
): boolean {
  const slotStart = slotToDate(dayYmd, slot);
  const slotEnd = addMinutesToSlot(dayYmd, slot, RESOURCE_GRID_SLOT_MINUTES);
  const start = new Date(reservation.start_date);
  const end = new Date(reservation.end_date);
  return start < slotEnd && end > slotStart;
}

export function formatTimeRange(start: Date | string, end: Date | string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  return `${s.toLocaleTimeString("cs-CZ", opts)}–${e.toLocaleTimeString("cs-CZ", opts)}`;
}

export function reservationOnDay(
  reservation: { start_date: Date | string; end_date: Date | string },
  dayYmd: string
): boolean {
  const dayStart = new Date(`${dayYmd}T00:00:00`);
  const dayEnd = new Date(`${dayYmd}T23:59:59`);
  const start = new Date(reservation.start_date);
  const end = new Date(reservation.end_date);
  return start <= dayEnd && end >= dayStart;
}

export function getWeekDayStrings(weekStart: Date): string[] {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(formatDateLocal(d));
  }
  return days;
}
