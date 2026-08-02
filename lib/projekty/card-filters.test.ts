import { describe, expect, it } from "vitest";
import { matchesFilters, parseCardFilters, serializeCardFilters } from "./card-filters";

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

describe("matchesFilters — priorita", () => {
  it("OR sémantika napříč vybranými stupni", () => {
    const urgent = card({ priority: "URGENT" });
    expect(matchesFilters(urgent, { priorities: ["URGENT", "HIGH"] })).toBe(true);
    expect(matchesFilters(urgent, { priorities: ["LOW"] })).toBe(false);
  });

  it("„none\" matchuje karty bez priority, ne naopak", () => {
    const withoutPriority = card();
    expect(matchesFilters(withoutPriority, { priorities: ["none"] })).toBe(true);
    expect(matchesFilters(withoutPriority, { priorities: ["URGENT"] })).toBe(false);
    expect(matchesFilters(card({ priority: "LOW" }), { priorities: ["none"] })).toBe(false);
  });

  it("bez filtru priority projde vše", () => {
    expect(matchesFilters(card({ priority: "LOW" }), {})).toBe(true);
    expect(matchesFilters(card(), { priorities: [] })).toBe(true);
  });
});

describe("parse/serialize priority", () => {
  it("round-trip přes URL", () => {
    const parsed = parseCardFilters(new URLSearchParams("priority=URGENT,none"));
    expect(parsed.priorities).toEqual(["URGENT", "none"]);
    expect(serializeCardFilters(parsed).get("priority")).toBe("URGENT,none");
  });

  it("neznámé hodnoty zahodí (jinak by filtr tiše nevrátil nic)", () => {
    expect(parseCardFilters(new URLSearchParams("priority=urgent")).priorities).toBeUndefined();
    expect(parseCardFilters(new URLSearchParams("priority=X,HIGH")).priorities).toEqual(["HIGH"]);
    expect(parseCardFilters(new URLSearchParams()).priorities).toBeUndefined();
  });
});
