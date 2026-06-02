import { describe, expect, it } from "vitest";
import {
  allDayEventDisplayDates,
  formatCalendarEventDurationPart,
  formatCalendarEventTitleWithDuration,
  formatCalendarListDateCell,
  formatCalendarListTimeCell,
  isAllDayEvent,
} from "./event-types";

describe("event-types all-day (Europe/Prague)", () => {
  it("dovolená 26. 6. – 7. 7. 2026 (CEST uložení)", () => {
    const start = new Date("2026-06-25T22:00:00.000Z");
    const end = new Date("2026-07-07T21:59:59.999Z");
    expect(isAllDayEvent(start, end)).toBe(true);
    const dates = allDayEventDisplayDates(start, end);
    expect(dates[0]).toBe("2026-06-26");
    expect(dates[dates.length - 1]).toBe("2026-07-07");
    expect(dates.length).toBe(12);
    expect(formatCalendarListTimeCell(start, end)).toBe("Celý den");
    expect(formatCalendarListDateCell(start, end)).toMatch(/26/);
    expect(formatCalendarListDateCell(start, end)).toMatch(/7/);
  });

  it("krátký interval 01:00–02:00 v Praze není celodenní", () => {
    const start = new Date("2026-06-26T00:00:00.000Z");
    const end = new Date("2026-06-26T01:00:00.000Z");
    expect(isAllDayEvent(start, end)).toBe(false);
    expect(allDayEventDisplayDates(start, end)).toEqual([]);
  });

  it("UTC půlnoč – exkluzivní konec další den", () => {
    const start = new Date("2026-06-26T00:00:00.000Z");
    const end = new Date("2026-06-27T00:00:00.000Z");
    expect(isAllDayEvent(start, end)).toBe(true);
    expect(allDayEventDisplayDates(start, end)).toEqual(["2026-06-26"]);
  });
});

describe("formatCalendarEventTitleWithDuration", () => {
  it("celodenní vícedenní dovolená", () => {
    const start = new Date("2026-06-25T22:00:00.000Z");
    const end = new Date("2026-07-07T21:59:59.999Z");
    const title = formatCalendarEventTitleWithDuration({
      title: "Dovolená",
      event_type: "dovolena",
      start_date: start,
      end_date: end,
    });
    expect(title).toMatch(/^Dovolená /);
    expect(title).toMatch(/26/);
    expect(title).toMatch(/7/);
    expect(title).toContain("–");
  });

  it("časovaná schůzka v jeden den", () => {
    const start = new Date("2026-05-25T08:00:00.000Z");
    const end = new Date("2026-05-25T11:00:00.000Z");
    const title = formatCalendarEventTitleWithDuration({
      title: "Lékař",
      event_type: "lekar",
      start_date: start,
      end_date: end,
    });
    expect(title).toMatch(/^Lékař /);
    expect(title).toMatch(/25\. 5\. 2026/);
    expect(title).toMatch(/10:00 – 13:00/);
  });

  it("časovaná událost přes dva dny", () => {
    const start = new Date("2026-05-25T06:00:00.000Z");
    const end = new Date("2026-05-26T16:00:00.000Z");
    const duration = formatCalendarEventDurationPart(start, end);
    expect(duration).toMatch(/25\. 5\. 2026/);
    expect(duration).toMatch(/26\. 5\. 2026/);
    expect(duration).toContain("–");
  });
});
