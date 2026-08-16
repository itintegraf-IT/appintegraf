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

  it("hranice dne se počítá kalendářně, ne přes +24 h", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 28, 23, 30));
    expect(sectionForDue(new Date(2026, 2, 29, 0, 30))).toBe("week");
    expect(sectionForDue(new Date(2026, 2, 28, 8, 0))).toBe("today");
  });

  it("hranice week/later drží i přes přechod na letní čas", () => {
    // V ČR se na letní čas přechází v neděli 29. 3. 2026 ve 2:00 — ten den má
    // 23 hodin. Kdyby se weekEnd počítal jako now + 7*24 h, posunul by se
    // o hodinu a termín přesně na hranici by spadl do špatné sekce.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 25, 12, 0)); // středa před přechodem

    // +6 dní = úterý 31. 3. (už po přechodu) musí být pořád „tento týden"
    expect(sectionForDue(new Date(2026, 2, 31, 12, 0))).toBe("week");
    // +7 dní = středa 1. 4. je první den, který do týdne nepatří
    expect(sectionForDue(new Date(2026, 3, 1, 0, 30))).toBe("later");
    // Den přechodu samotný
    expect(sectionForDue(new Date(2026, 2, 29, 23, 0))).toBe("week");
  });

  it("hranice week/later drží i přes přechod na zimní čas", () => {
    // Zpátky na zimní čas: neděle 25. 10. 2026, ten den má 25 hodin.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 22, 12, 0)); // čtvrtek před přechodem

    expect(sectionForDue(new Date(2026, 9, 28, 12, 0))).toBe("week"); // +6 dní
    expect(sectionForDue(new Date(2026, 9, 29, 0, 30))).toBe("later"); // +7 dní
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
