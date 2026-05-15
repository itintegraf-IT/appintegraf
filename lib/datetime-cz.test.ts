import { describe, expect, it } from "vitest";
import {
  formatDateTimeCz,
  formatDateTimeLocalForInput,
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
});
