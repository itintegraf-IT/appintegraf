import {
  formatDateLocal,
  getWeekEnd,
  getWeekStart,
  parseDateLocal,
} from "@/app/(dashboard)/calendar/lib/week-utils";

export type ResourceScheduleView = "day" | "week";

export function parseResourceScheduleParams(params: {
  day?: string;
  from?: string;
  view?: string;
}) {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const view: ResourceScheduleView = params.view === "day" ? "day" : "week";
  const today = formatDateLocal(new Date());
  const day = params.day && dateRe.test(params.day) ? params.day : today;
  const anchor =
    params.from && dateRe.test(params.from)
      ? parseDateLocal(params.from)
      : parseDateLocal(day);
  const weekStart = getWeekStart(anchor);
  const weekEnd = getWeekEnd(anchor);

  return {
    view,
    day,
    weekFrom: formatDateLocal(weekStart),
    weekTo: formatDateLocal(weekEnd),
    weekStart,
    weekEnd,
  };
}
