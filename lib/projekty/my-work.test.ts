import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWorkSections,
  isRecentlyAssigned,
  sectionForDue,
  sortItems,
  type WorkItem,
} from "./my-work";

function item(overrides: Partial<WorkItem> & { id: string }): WorkItem {
  return {
    kind: "card",
    title: `Položka ${overrides.id}`,
    due: null,
    completed: false,
    priority: null,
    isNew: false,
    context: null,
    href: null,
    ...overrides,
  };
}

function daysFromToday(days: number, hour = 12): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("sectionForDue", () => {
  it("včera → overdue, dnes → today", () => {
    expect(sectionForDue(daysFromToday(-1))).toBe("overdue");
    expect(sectionForDue(daysFromToday(0, 0))).toBe("today");
    expect(sectionForDue(daysFromToday(0, 23))).toBe("today");
  });

  it("zítra až +6 dní → week, +7 a dál → later", () => {
    expect(sectionForDue(daysFromToday(1))).toBe("week");
    expect(sectionForDue(daysFromToday(6))).toBe("week");
    expect(sectionForDue(daysFromToday(7))).toBe("later");
    expect(sectionForDue(daysFromToday(30))).toBe("later");
  });

  it("bez termínu → noDue", () => {
    expect(sectionForDue(null)).toBe("noDue");
  });

  it("hranice dne se počítá kalendářně, ne přes +24 h (DST)", () => {
    // 29. 3. 2026 je v ČR jarní přechod na letní čas → neděle má 23 hodin.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 28, 23, 30));
    expect(sectionForDue(new Date(2026, 2, 29, 0, 30))).toBe("week");
    expect(sectionForDue(new Date(2026, 2, 28, 8, 0))).toBe("today");
  });
});

describe("sortItems", () => {
  it("priorita má přednost před termínem", () => {
    const sorted = sortItems([
      item({ id: "a", priority: null, due: daysFromToday(0) }),
      item({ id: "b", priority: "URGENT", due: daysFromToday(5) }),
      item({ id: "c", priority: "MEDIUM", due: daysFromToday(1) }),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  it("při shodné prioritě rozhoduje termín, bez termínu jde dozadu", () => {
    const sorted = sortItems([
      item({ id: "pozdeji", priority: "HIGH", due: daysFromToday(3) }),
      item({ id: "bezTerminu", priority: "HIGH", due: null }),
      item({ id: "driv", priority: "HIGH", due: daysFromToday(1) }),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["driv", "pozdeji", "bezTerminu"]);
  });

  it("při shodě obojího řadí podle názvu česky", () => {
    const sorted = sortItems([
      item({ id: "1", title: "Žaluzie" }),
      item({ id: "2", title: "Alobal" }),
      item({ id: "3", title: "Čočka" }),
    ]);
    expect(sorted.map((i) => i.title)).toEqual(["Alobal", "Čočka", "Žaluzie"]);
  });

  it("nemutuje vstupní pole", () => {
    const input = [item({ id: "a" }), item({ id: "b", priority: "URGENT" })];
    sortItems(input);
    expect(input.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("buildWorkSections", () => {
  it("sekce v pevném pořadí naléhavosti, prázdné vynechá", () => {
    const sections = buildWorkSections([
      item({ id: "later", due: daysFromToday(20) }),
      item({ id: "overdue", due: daysFromToday(-2) }),
      item({ id: "noDue" }),
    ]);
    expect(sections.map((s) => s.key)).toEqual(["overdue", "later", "noDue"]);
    expect(sections.map((s) => s.label)).toEqual(["Po termínu", "Později", "Bez termínu"]);
  });

  it("karty i osobní úkoly padnou do stejné sekce", () => {
    const sections = buildWorkSections([
      item({ id: "karta", kind: "card", due: daysFromToday(0) }),
      item({ id: "ukol", kind: "todo", due: daysFromToday(0), priority: "URGENT" }),
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.items.map((i) => i.id)).toEqual(["ukol", "karta"]);
  });

  it("prázdný vstup → žádné sekce", () => {
    expect(buildWorkSections([])).toEqual([]);
  });
});

describe("isRecentlyAssigned", () => {
  it("do 7 dnů ano, starší ne", () => {
    const now = new Date(2026, 7, 2, 10, 0);
    expect(isRecentlyAssigned(new Date(2026, 7, 1), now)).toBe(true);
    expect(isRecentlyAssigned(new Date(2026, 6, 20), now)).toBe(false);
  });

  it("chybějící nebo neplatná hodnota → false", () => {
    expect(isRecentlyAssigned(null)).toBe(false);
    expect(isRecentlyAssigned(undefined)).toBe(false);
    expect(isRecentlyAssigned("nesmysl")).toBe(false);
  });
});
