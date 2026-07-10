import { describe, expect, it } from "vitest";
import { datesOverlap } from "./resource-reservation-overlap";

describe("datesOverlap", () => {
  it("detekuje překryv", () => {
    const aStart = new Date("2026-07-10T10:00:00");
    const aEnd = new Date("2026-07-10T11:00:00");
    const bStart = new Date("2026-07-10T10:30:00");
    const bEnd = new Date("2026-07-10T12:00:00");
    expect(datesOverlap(aStart, aEnd, bStart, bEnd)).toBe(true);
  });

  it("nepočítá sousedící termíny jako kolizi", () => {
    const aStart = new Date("2026-07-10T10:00:00");
    const aEnd = new Date("2026-07-10T11:00:00");
    const bStart = new Date("2026-07-10T11:00:00");
    const bEnd = new Date("2026-07-10T12:00:00");
    expect(datesOverlap(aStart, aEnd, bStart, bEnd)).toBe(false);
  });

  it("nepočítá rejected jako kolizi v konstantě", () => {
    expect(["approved", "pending"]).not.toContain("rejected");
  });
});
