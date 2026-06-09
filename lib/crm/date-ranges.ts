export type DateRange = { start: Date; end: Date };

export function getMonthRange(now: Date): DateRange {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { start, end };
}

export function getQuarterRange(now: Date): DateRange {
  const year = now.getUTCFullYear();
  const quarterIdx = Math.floor(now.getUTCMonth() / 3);
  const startMonth = quarterIdx * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 1));
  return { start, end };
}
