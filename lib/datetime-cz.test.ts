import { describe, expect, it } from "vitest";
import {
  allDayYmdRangeToIsoStrings,
  buildWeekDayYmds,
  formatDateTimeCz,
  formatDateTimeLocalForInput,
  formatDateYmdPrague,
  formatTimeCz,
  formatWeekColumnHeaderLabel,
  getMonthGridDayYmds,
  getPragueHourFraction,
  getPragueParts,
  getPragueWeekdayIndex,
  getWeekStartYmdPrague,
  parseDateTimeLocalInput,
  pragueDayEnd,
  pragueDayStart,
} from "./datetime-cz";

describe("datetime-cz", () => {
  it("roundtrip pro datetime-local v Europe/Prague", () => {
    const input = "2026-05-16T09:44";
    const parsed = parseDateTimeLocalInput(input);
    expect(formatDateTimeLocalForInput(parsed)).toBe(input);
    expect(formatDateTimeCz(parsed)).toMatch(/16\.?\s*05\.?\s*2026.*09:44/);
  });

  it("toISOString slice by neodpovídalo místnímu času (CEST +2h)", () => {
    const summerUtc = new Date("2026-05-16T07:44:00.000Z");
    const isoSlice = summerUtc.toISOString().slice(0, 16);
    const pragueInput = formatDateTimeLocalForInput(summerUtc);
    expect(isoSlice).toBe("2026-05-16T07:44");
    expect(pragueInput).toBe("2026-05-16T09:44");
  });

  it("allDayYmdRangeToIsoStrings ukládá Prahu 00:00–23:59 nezávisle na TZ runtime", () => {
    const { start, end } = allDayYmdRangeToIsoStrings("2026-06-26", "2026-07-07");
    expect(start).toBe("2026-06-25T22:00:00.000Z");
    expect(end).toBe("2026-07-07T21:59:59.999Z");
    expect(formatDateYmdPrague(new Date(start))).toBe("2026-06-26");
    expect(formatDateYmdPrague(new Date(end))).toBe("2026-07-07");
  });

  it("getPragueParts normalizuje půlnoc (hour 24 → 0)", () => {
    const pragueMidnight = new Date("2026-06-25T22:00:00.000Z");
    expect(getPragueParts(pragueMidnight).hour).toBe(0);
    expect(getPragueParts(pragueMidnight).minute).toBe(0);
  });

  it("formatTimeCz zobrazí Prague čas bez ohledu na TZ runtime", () => {
    const summerUtc = new Date("2026-05-28T06:00:00.000Z");
    expect(formatTimeCz(summerUtc)).toMatch(/08:00/);
    expect(getPragueHourFraction(summerUtc)).toBe(8);
    expect(formatDateYmdPrague(summerUtc)).toBe("2026-05-28");
  });

  it("buildWeekDayYmds – sedm po sobě jdoucích pražských dnů", () => {
    expect(buildWeekDayYmds("2026-08-29")).toEqual([
      "2026-08-29",
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
    ]);
  });

  it("getWeekStartYmdPrague – pondělí týdne", () => {
    expect(getPragueWeekdayIndex("2026-09-01")).toBe(1);
    expect(getWeekStartYmdPrague("2026-09-01")).toBe("2026-08-31");
  });

  it("getMonthGridDayYmds – 42 dní mřížky", () => {
    const days = getMonthGridDayYmds("2026-09");
    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2026-08-31");
    expect(days).toContain("2026-09-01");
  });

  it("formatWeekColumnHeaderLabel a pražské hranice dne", () => {
    expect(formatWeekColumnHeaderLabel("2026-09-01")).toMatch(/1\. 9\./);
    const start = pragueDayStart("2026-09-01");
    const end = pragueDayEnd("2026-09-01");
    expect(formatDateYmdPrague(start)).toBe("2026-09-01");
    expect(formatDateYmdPrague(end)).toBe("2026-09-01");
    expect(start.getTime()).toBeLessThan(end.getTime());
    const eventStart = new Date("2026-09-01T07:00:00.000Z");
    const eventEnd = new Date("2026-09-01T09:00:00.000Z");
    expect(eventStart >= end || eventEnd <= start).toBe(false);
    expect(eventStart >= start && eventEnd <= end).toBe(true);
  });

  it("pragueDayEnd – hranice 31. 8. neprotíná událost 1. 9.", () => {
    const aug31End = pragueDayEnd("2026-08-31");
    const sep1Start = pragueDayStart("2026-09-01");
    expect(aug31End.getTime()).toBeLessThan(sep1Start.getTime());
    expect(formatDateYmdPrague(aug31End)).toBe("2026-08-31");

    const eventStart = new Date("2026-09-01T07:00:00.000Z");
    const eventEnd = new Date("2026-09-01T09:00:00.000Z");
    const aug31Start = pragueDayStart("2026-08-31");
    expect(eventEnd <= aug31Start || eventStart >= aug31End).toBe(true);
  });
});
