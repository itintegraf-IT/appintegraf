import { describe, expect, it } from "vitest";
import {
  getTimedEventSliceForDay,
  timedEventOverlapsDay,
} from "./calendar-week-slice";
import { formatTimeCz } from "./datetime-cz";

const ROW_HEIGHT = 32;
const DAY_GRID_HEIGHT = 24 * ROW_HEIGHT;

describe("calendar-week-slice", () => {
  const eventStart = new Date("2026-09-01T07:00:00.000Z");
  const eventEnd = new Date("2026-09-01T09:00:00.000Z");

  it("jednodenní událost 1. 9. 09–11 se nezobrazí ve sloupci 31. 8.", () => {
    expect(timedEventOverlapsDay(eventStart, eventEnd, "2026-08-31")).toBe(
      false
    );
    expect(timedEventOverlapsDay(eventStart, eventEnd, "2026-09-01")).toBe(
      true
    );

    expect(
      getTimedEventSliceForDay(
        eventStart,
        eventEnd,
        "2026-08-31",
        ROW_HEIGHT,
        DAY_GRID_HEIGHT
      )
    ).toBeNull();

    const slice = getTimedEventSliceForDay(
      eventStart,
      eventEnd,
      "2026-09-01",
      ROW_HEIGHT,
      DAY_GRID_HEIGHT
    );
    expect(slice).not.toBeNull();
    expect(formatTimeCz(slice!.sliceStart)).toMatch(/09:00/);
    expect(formatTimeCz(slice!.sliceEnd)).toMatch(/11:00/);
  });

  it("vícedenní časovaná událost zůstane na obou dnech", () => {
    const start = new Date("2026-09-01T20:00:00.000Z");
    const end = new Date("2026-09-02T08:00:00.000Z");
    expect(timedEventOverlapsDay(start, end, "2026-09-01")).toBe(true);
    expect(timedEventOverlapsDay(start, end, "2026-09-02")).toBe(true);
    expect(timedEventOverlapsDay(start, end, "2026-08-31")).toBe(false);
  });
});
