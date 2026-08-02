import { describe, expect, it } from "vitest";
import {
  CARD_PRIORITIES,
  comparePriority,
  parsePriority,
  priorityRank,
  PRIORITY_LABELS,
} from "./priority";

describe("comparePriority", () => {
  it("řadí od nejnaléhavější po nejnižší", () => {
    const shuffled = ["LOW", "URGENT", "MEDIUM", "HIGH"] as const;
    expect([...shuffled].sort(comparePriority)).toEqual([
      "URGENT",
      "HIGH",
      "MEDIUM",
      "LOW",
    ]);
  });

  it("karty bez priority končí na konci, ne jako nejnižší", () => {
    const items = ["LOW", null, "URGENT", undefined] as const;
    expect([...items].sort(comparePriority)).toEqual([
      "URGENT",
      "LOW",
      null,
      undefined,
    ]);
  });

  it("dvě stejné hodnoty vrací 0 (rozhoduje navazující kritérium)", () => {
    expect(comparePriority("HIGH", "HIGH")).toBe(0);
    expect(comparePriority(null, undefined)).toBe(0);
  });
});

describe("parsePriority", () => {
  it("propouští jen známé hodnoty", () => {
    expect(parsePriority("URGENT")).toBe("URGENT");
    expect(parsePriority("urgent")).toBeNull();
    expect(parsePriority("NONE")).toBeNull();
    expect(parsePriority(null)).toBeNull();
    expect(parsePriority(3)).toBeNull();
  });
});

describe("priorityRank", () => {
  it("null je vždy horší než jakákoli priorita", () => {
    for (const p of CARD_PRIORITIES) {
      expect(priorityRank(p)).toBeLessThan(priorityRank(null));
    }
  });
});

describe("PRIORITY_LABELS", () => {
  it("má český popisek pro každou hodnotu enumu", () => {
    for (const p of CARD_PRIORITIES) {
      expect(PRIORITY_LABELS[p]).toBeTruthy();
    }
  });
});
