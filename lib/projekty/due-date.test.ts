import { describe, expect, it } from "vitest";
import { formatDue, getDueStatus, startOfLocalDay } from "./due-date";

function daysFromToday(days: number, hour = 12, minute = 0): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, minute);
}

describe("getDueStatus", () => {
  it("včera → overdue", () => {
    expect(getDueStatus(daysFromToday(-1), false)).toBe("overdue");
  });

  it("dnes 00:00 i 23:59 → today", () => {
    expect(getDueStatus(daysFromToday(0, 0, 0), false)).toBe("today");
    expect(getDueStatus(daysFromToday(0, 23, 59), false)).toBe("today");
  });

  it("zítra → upcoming", () => {
    expect(getDueStatus(daysFromToday(1, 0, 0), false)).toBe("upcoming");
  });

  it("completed → none i po termínu (hotové nehoří)", () => {
    expect(getDueStatus(daysFromToday(-3), true)).toBe("none");
    expect(getDueStatus(daysFromToday(0), true)).toBe("none");
  });

  it("null/undefined → none", () => {
    expect(getDueStatus(null, false)).toBe("none");
    expect(getDueStatus(undefined, false)).toBe("none");
  });

  it("přijímá ISO string", () => {
    expect(getDueStatus(daysFromToday(-2).toISOString(), false)).toBe("overdue");
  });
});

describe("startOfLocalDay", () => {
  it("ořízne čas na lokální půlnoc", () => {
    const d = new Date(2026, 6, 31, 15, 45, 12);
    expect(startOfLocalDay(d).getTime()).toBe(new Date(2026, 6, 31).getTime());
  });
});

describe("formatDue", () => {
  const date = new Date(2026, 6, 31, 9, 5); // 31. 7. 2026 09:05

  it("varianty formátu", () => {
    expect(formatDue(date, "short")).toBe("31. 7.");
    expect(formatDue(date, "withYear")).toBe("31. 7. 2026");
    expect(formatDue(date, "withTime")).toBe("31. 7. 2026 09:05");
  });

  it("default je short a přijímá string", () => {
    expect(formatDue(date.toISOString())).toBe("31. 7.");
  });
});
