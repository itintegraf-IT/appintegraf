import { format, isValid } from "date-fns";

/**
 * Convert a Date / ISO string to "YYYY-MM-DDTHH:mm" in **local time**,
 * for use as the `value` of `<input type="datetime-local">`.
 *
 * Why this helper exists: `date.toISOString().slice(0, 16)` returns the
 * value in UTC. The datetime-local input then interprets that string as
 * LOCAL time per WHATWG spec — the user sees the value shifted by their
 * TZ offset (e.g. -2 h in CEST). This helper formats in local time so
 * the round-trip is offset-stable.
 */
export function toDatetimeLocalInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!isValid(d)) return "";
  return format(d, "yyyy-MM-dd'T'HH:mm");
}
