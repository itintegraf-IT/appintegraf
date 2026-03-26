/**
 * Validace umístění bloků ZAKAZKA vůči pracovní době strojů (Europe/Prague).
 * Používá tabulky planovani_machine_work_hours a planovani_machine_schedule_exceptions.
 */
import { prisma } from "@/lib/db";

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const PRAGUE_FORMATTER = new Intl.DateTimeFormat("en", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  hour12: false,
});

export function pragueOf(d: Date): { hour: number; dayOfWeek: number; dateStr: string } {
  const parts = PRAGUE_FORMATTER.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    hour: parseInt(get("hour"), 10),
    dayOfWeek: DOW_SHORT.indexOf(get("weekday") as (typeof DOW_SHORT)[number]),
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

type ScheduleRow = {
  machine: string;
  dayOfWeek: number;
  startHour: number;
  endHour: number;
  isActive: boolean;
};
type ExceptionRow = {
  machine: string;
  date: Date;
  startHour: number;
  endHour: number;
  isActive: boolean;
};

export function checkSlotAgainstSchedule(
  startTime: Date,
  endTime: Date,
  machine: string,
  schedule: ScheduleRow[],
  exceptions: ExceptionRow[]
): string | null {
  const machineSchedule = schedule.filter((r) => r.machine === machine);
  const machineExceptions = exceptions.filter((e) => e.machine === machine);
  if (machineSchedule.length === 0 && machineExceptions.length === 0) return null;
  const SLOT_MS = 30 * 60 * 1000;
  let cur = new Date(startTime);
  while (cur < endTime) {
    const { hour, dayOfWeek, dateStr } = pragueOf(cur);
    const exc = machineExceptions.find((e) => new Date(e.date).toISOString().slice(0, 10) === dateStr);
    const row = exc ?? machineSchedule.find((r) => r.dayOfWeek === dayOfWeek);
    if (row && (!row.isActive || hour < row.startHour || hour >= row.endHour)) {
      return "Blok zasahuje do doby mimo provoz stroje.";
    }
    cur = new Date(cur.getTime() + SLOT_MS);
  }
  return null;
}

export async function checkPlanovaniScheduleViolation(
  machine: string,
  startTime: Date,
  endTime: Date
): Promise<string | null> {
  const [schedule, exceptions] = await Promise.all([
    prisma.planovani_machine_work_hours.findMany({ where: { machine } }),
    prisma.planovani_machine_schedule_exceptions.findMany({
      where: {
        machine,
        date: {
          gte: new Date(new Date(startTime).getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(new Date(endTime).getTime() + 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);
  return checkSlotAgainstSchedule(startTime, endTime, machine, schedule, exceptions);
}
