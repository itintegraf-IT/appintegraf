import { describe, expect, it } from "vitest";
import {
  allDayYmdRangeToIsoStrings,
  formatDateTimeCz,
  formatDateTimeLocalForInput,
  formatDateYmdPrague,
  formatTimeCz,
  getPragueHourFraction,
  getPragueParts,
  parseDateTimeLocalInput,
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
});
