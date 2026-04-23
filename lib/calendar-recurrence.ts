import { addDays, addWeeks, addMonths } from "date-fns";

export type RecurrenceKind = "none" | "daily" | "weekly" | "monthly";

const MAX_OCCURRENCES = 200;

/**
 * Vrátí seznam { start, end } pro první událost a opakování do `until` (včetně dne, 23:59:59.999).
 */
export function expandRecurrence(
  start: Date,
  end: Date,
  kind: RecurrenceKind,
  until: Date
): { start: Date; end: Date }[] {
  if (kind === "none") {
    return [{ start: new Date(start), end: new Date(end) }];
  }

  const limit = new Date(until);
  limit.setHours(23, 59, 59, 999);

  if (start.getTime() > limit.getTime()) {
    return [];
  }

  const out: { start: Date; end: Date }[] = [];
  let s = new Date(start);
  let e = new Date(end);
  let n = 0;

  while (n < MAX_OCCURRENCES) {
    if (s.getTime() > limit.getTime()) break;
    out.push({ start: new Date(s), end: new Date(e) });
    n++;
    if (kind === "daily") {
      s = addDays(s, 1);
      e = addDays(e, 1);
    } else if (kind === "weekly") {
      s = addWeeks(s, 1);
      e = addWeeks(e, 1);
    } else {
      s = addMonths(s, 1);
      e = addMonths(e, 1);
    }
  }
  return out;
}
