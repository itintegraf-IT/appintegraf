import { describe, expect, it } from "vitest";
import { matchesFilters } from "./card-filters";

// Regresní síť před refaktorem dueRange na lib/projekty/due-date.ts —
// zachycuje stávající sémantiku filtrů (pozor: filtr "today"/"week" completed
// záměrně ignoruje, na rozdíl od badge).

function card(overrides: Partial<Parameters<typeof matchesFilters>[0]> = {}) {
  return {
    title: "Testovací karta",
    completed: false,
    dueDate: null as Date | string | null,
    members: [] as { userId: number }[],
    labels: [] as { labelId: string }[],
    ...overrides,
  };
}

function daysFromToday(days: number, hour = 12): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour);
}

describe("matchesFilters — dueRange", () => {
  it("overdue: včerejší nedokončená ano, dokončená ne", () => {
    expect(matchesFilters(card({ dueDate: daysFromToday(-1) }), { dueRange: "overdue" })).toBe(true);
    expect(
      matchesFilters(card({ dueDate: daysFromToday(-1), completed: true }), { dueRange: "overdue" }),
    ).toBe(false);
  });

  it("overdue: dnešní ani zítřejší nespadá", () => {
    expect(matchesFilters(card({ dueDate: daysFromToday(0) }), { dueRange: "overdue" })).toBe(false);
    expect(matchesFilters(card({ dueDate: daysFromToday(1) }), { dueRange: "overdue" })).toBe(false);
  });

  it("today: jen dnešek, completed se ignoruje (stávající sémantika filtru)", () => {
    expect(matchesFilters(card({ dueDate: daysFromToday(0) }), { dueRange: "today" })).toBe(true);
    expect(
      matchesFilters(card({ dueDate: daysFromToday(0), completed: true }), { dueRange: "today" }),
    ).toBe(true);
    expect(matchesFilters(card({ dueDate: daysFromToday(-1) }), { dueRange: "today" })).toBe(false);
    expect(matchesFilters(card({ dueDate: daysFromToday(1) }), { dueRange: "today" })).toBe(false);
  });

  it("week: dnes až +6 dní ano, -1 a +7 ne", () => {
    expect(matchesFilters(card({ dueDate: daysFromToday(0) }), { dueRange: "week" })).toBe(true);
    expect(matchesFilters(card({ dueDate: daysFromToday(6) }), { dueRange: "week" })).toBe(true);
    expect(matchesFilters(card({ dueDate: daysFromToday(-1) }), { dueRange: "week" })).toBe(false);
    expect(matchesFilters(card({ dueDate: daysFromToday(7) }), { dueRange: "week" })).toBe(false);
  });

  it("none: bez termínu ano, s termínem ne", () => {
    expect(matchesFilters(card(), { dueRange: "none" })).toBe(true);
    expect(matchesFilters(card({ dueDate: daysFromToday(3) }), { dueRange: "none" })).toBe(false);
  });

  it("bez dueRange termín nefiltruje", () => {
    expect(matchesFilters(card({ dueDate: daysFromToday(-5) }), {})).toBe(true);
  });
});

describe("matchesFilters — ostatní", () => {
  it("fulltext na titulek (case-insensitive)", () => {
    expect(matchesFilters(card(), { q: "testovací" })).toBe(true);
    expect(matchesFilters(card(), { q: "jiné" })).toBe(false);
  });

  it("completed filtr", () => {
    expect(matchesFilters(card({ completed: true }), { completed: "true" })).toBe(true);
    expect(matchesFilters(card({ completed: true }), { completed: "false" })).toBe(false);
    expect(matchesFilters(card({ completed: true }), { completed: "any" })).toBe(true);
  });

  it("members/labels OR sémantika", () => {
    const c = card({ members: [{ userId: 1 }], labels: [{ labelId: "l1" }] });
    expect(matchesFilters(c, { memberIds: ["1", "2"] })).toBe(true);
    expect(matchesFilters(c, { memberIds: ["2"] })).toBe(false);
    expect(matchesFilters(c, { labelIds: ["l1"] })).toBe(true);
    expect(matchesFilters(c, { labelIds: ["l2"] })).toBe(false);
  });
});
