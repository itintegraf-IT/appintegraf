import {
  formatDateYmdPrague,
  getPragueHourFraction,
  pragueDayEnd,
  pragueDayStart,
} from "./datetime-cz";

/** True pokud časovaná událost patří do sloupce dayYmd (Europe/Prague). */
export function timedEventOverlapsDay(
  start: Date,
  end: Date,
  dayYmd: string
): boolean {
  const startYmd = formatDateYmdPrague(start);
  const endYmd = formatDateYmdPrague(end);
  if (startYmd === endYmd && startYmd !== dayYmd) return false;

  const dayStart = pragueDayStart(dayYmd);
  const dayEnd = pragueDayEnd(dayYmd);
  return end > dayStart && start < dayEnd;
}

export type EventDaySlice = {
  top: number;
  height: number;
  sliceStart: Date;
  sliceEnd: Date;
};

/** Vypočítá top a height pro daný den – výška je vždy oříznutá na konec dne (24 hodin). */
export function getTimedEventSliceForDay(
  startDate: Date,
  endDate: Date,
  dayYmd: string,
  rowHeight: number,
  dayGridHeight: number
): EventDaySlice | null {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (!timedEventOverlapsDay(start, end, dayYmd)) return null;

  const dayStart = pragueDayStart(dayYmd);
  const dayEnd = pragueDayEnd(dayYmd);

  const sliceStart = start < dayStart ? dayStart : start;
  const sliceEnd = end > dayEnd ? dayEnd : end;

  const top = getPragueHourFraction(sliceStart) * rowHeight;
  const durationHours =
    (sliceEnd.getTime() - sliceStart.getTime()) / (60 * 60 * 1000);
  let height = Math.max(18, durationHours * rowHeight);

  const maxHeight = dayGridHeight - top;
  height = Math.min(height, maxHeight);

  return { top, height, sliceStart, sliceEnd };
}
