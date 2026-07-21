import {
  addDays,
  endOfWeek,
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";

type CardForCalendar = {
  id: string;
  number: string;
  title: string;
  completed: boolean;
  startDate: Date | string | null;
  dueDate: Date | string | null;
  members: {
    userId: number;
    user: { id: number; name: string | null; image: string | null; email: string | null };
  }[];
  labels: { labelId: string; label: { id: string; name: string; color: string } }[];
};

export type CalendarPill = {
  card: CardForCalendar;
  type: "point" | "bar";
  /** ISO date "YYYY-MM-DD" prvého dne segmentu (clamped na týden gridu). */
  spanStart: string;
  /** ISO date posledního dne segmentu. */
  spanEnd: string;
  /** True pokud bar pokračuje doleva (range začal dříve než tento segment). */
  continuesLeft: boolean;
  /** True pokud bar pokračuje doprava (range pokračuje za tento segment). */
  continuesRight: boolean;
};

export type DayCell = {
  date: Date;
  iso: string;
  outOfMonth: boolean;
  isToday: boolean;
  pills: CalendarPill[];
};

export type Week = DayCell[];

export type BuildMonthGridInput = {
  year: number;
  /** 1–12 */
  month: number;
  cards: CardForCalendar[];
};

const ISO = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * Convert a date or ISO string to a local-midnight Date.
 * This normalises timezone offsets so that "2026-05-13T23:00:00Z" (which is
 * 2026-05-14 01:00 in CET) is treated as 2026-05-13 at the day level.
 * We extract the calendar date from the UTC representation of the ISO string
 * (YYYY-MM-DD prefix), then build a local midnight Date from those parts.
 */
function toDate(d: Date | string): Date {
  if (typeof d === "string") {
    // Extract the YYYY-MM-DD portion directly from the string (UTC-based).
    // This prevents TZ-shift from changing the displayed date.
    const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(parseInt(match[1]!), parseInt(match[2]!) - 1, parseInt(match[3]!));
    }
    return parseISO(d);
  }
  // For Date objects, normalize to local midnight
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Porovná dvě data na úrovni dne (ignoruje čas). */
function dateOnlyMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dateLte(a: Date, b: Date): boolean {
  return dateOnlyMs(a) <= dateOnlyMs(b);
}

function dateLt(a: Date, b: Date): boolean {
  return dateOnlyMs(a) < dateOnlyMs(b);
}

function dateGt(a: Date, b: Date): boolean {
  return dateOnlyMs(a) > dateOnlyMs(b);
}

/**
 * Construct a 6-week grid (always 42 cells, Mon–Sun) for a given month.
 *
 * Pills:
 * - Card with only dueDate (no startDate) → 1 "point" pill on dueDate.
 * - Card with startDate AND dueDate → 1+ "bar" segments split across week boundaries.
 * - Card without dueDate → not visible.
 * - Bars/points outside the visible 6-week grid are filtered out.
 *
 * Pill is pushed into the cell of its segment START.
 */
export function buildMonthGrid(input: BuildMonthGridInput): Week[] {
  const { year, month, cards } = input;
  const today = new Date();

  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  // Always produce exactly 42 cells (6 weeks)
  const gridEnd = addDays(gridStart, 41);

  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i);
    cells.push({
      date,
      iso: ISO(date),
      outOfMonth: date.getMonth() !== month - 1 || date.getFullYear() !== year,
      isToday: isSameDay(date, today),
      pills: [],
    });
  }

  const isoToIndex = new Map<string, number>();
  cells.forEach((c, i) => isoToIndex.set(c.iso, i));

  for (const card of cards) {
    const due = card.dueDate ? toDate(card.dueDate) : null;
    const start = card.startDate ? toDate(card.startDate) : null;

    // Card must have dueDate to appear in the grid
    if (!due) continue;

    if (!start) {
      // Point pill: single dueDate, no startDate
      if (isWithinInterval(new Date(due.getFullYear(), due.getMonth(), due.getDate()), {
        start: gridStart,
        end: gridEnd,
      })) {
        const cellIdx = isoToIndex.get(ISO(due));
        if (cellIdx !== undefined) {
          cells[cellIdx]!.pills.push({
            card,
            type: "point",
            spanStart: ISO(due),
            spanEnd: ISO(due),
            continuesLeft: false,
            continuesRight: false,
          });
        }
      }
      continue;
    }

    // Range bar — split into per-week segments
    // Clamp to grid bounds
    const rangeStart = dateLt(start, gridStart) ? gridStart : start;
    const rangeEnd = dateGt(due, gridEnd) ? gridEnd : due;

    // If the entire range is outside the grid, skip
    if (dateGt(rangeStart, gridEnd) || dateLt(rangeEnd, gridStart)) continue;
    if (dateGt(rangeStart, rangeEnd)) continue;

    let cursor = rangeStart;
    while (dateLte(cursor, rangeEnd)) {
      const weekEnd = endOfWeek(cursor, { weekStartsOn: 1 });
      const segmentEnd = dateLt(weekEnd, rangeEnd) ? weekEnd : rangeEnd;

      // continuesLeft: this segment doesn't start at the true start of the range
      // (i.e., the original start was before gridStart, or this isn't the first segment)
      const isFirstSegment = isSameDay(cursor, rangeStart);
      const continuesLeft = isFirstSegment ? dateLt(start, gridStart) : true;

      // continuesRight: this segment doesn't end at the true end of the range
      // i.e., segmentEnd is weekEnd (not rangeEnd), OR due is beyond gridEnd
      // (clamped — last segment ends at gridEnd but real due is later).
      const isLastSegment = isSameDay(segmentEnd, rangeEnd);
      const continuesRight = isLastSegment ? dateGt(due, gridEnd) : true;

      const cellIso = ISO(cursor);
      const cellIdx = isoToIndex.get(cellIso);
      if (cellIdx !== undefined) {
        cells[cellIdx]!.pills.push({
          card,
          type: "bar",
          spanStart: cellIso,
          spanEnd: ISO(segmentEnd),
          continuesLeft,
          continuesRight,
        });
      }

      cursor = addDays(segmentEnd, 1);
    }
  }

  const weeks: Week[] = [];
  for (let i = 0; i < 42; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}
