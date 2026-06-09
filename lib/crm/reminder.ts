import { startOfDay } from "date-fns";
import type { crm_activity_type } from "@prisma/client";

/**
 * Reminder = subset crm_activities types nabízený v quick-add a zobrazený v RemindersWidget.
 * EMAIL a NOTE jsou explicitně mimo (vlastní workflow).
 */
export const REMINDER_TYPES = ["CALL", "MEETING", "REMINDER"] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

export const REMINDER_TYPE_LABEL: Record<ReminderType, string> = {
  CALL: "Hovor",
  MEETING: "Schůzka",
  REMINDER: "Připomenutí",
};

/** Tailwind class pro tečku v kalendáři. Raynet-inspired. */
export const REMINDER_DOT_COLOR: Record<ReminderType, string> = {
  CALL: "bg-sky-500",
  MEETING: "bg-emerald-500",
  REMINDER: "bg-amber-500",
};

/** Je tato activity zobrazitelná v RemindersWidget? */
export function isReminderRelevant(type: crm_activity_type): type is ReminderType {
  return (REMINDER_TYPES as readonly crm_activity_type[]).includes(type);
}

export function isCompleted(ref: { completed_at: Date | string | null }): boolean {
  return ref.completed_at !== null;
}

/** Overdue = date je před dneškem A nedokončené. */
export function isOverdue(ref: { date: Date | string; completed_at: Date | string | null }): boolean {
  if (isCompleted(ref)) return false;
  const today = startOfDay(new Date());
  const d = typeof ref.date === "string" ? new Date(ref.date) : ref.date;
  return startOfDay(d).getTime() < today.getTime();
}
