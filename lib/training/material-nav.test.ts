import { describe, expect, it } from "vitest";
import {
  filterMaterialsByCategory,
  getMaterialNavPosition,
  sortMaterials,
} from "@/lib/training/material-nav";

describe("material-nav", () => {
  const items = [
    { id: 1, title: "B materiál", categoryId: 2, categoryName: "Beta" },
    { id: 2, title: "A materiál", categoryId: 1, categoryName: "Alfa" },
    { id: 3, title: "C materiál", categoryId: 1, categoryName: "Alfa" },
  ];

  it("seřadí podle okruhu a názvu", () => {
    const sorted = sortMaterials(items);
    expect(sorted.map((m) => m.id)).toEqual([2, 3, 1]);
  });

  it("filtruje podle okruhu", () => {
    const filtered = filterMaterialsByCategory(items, 1);
    expect(filtered.map((m) => m.id)).toEqual([2, 3]);
  });

  it("vrátí předchozí a další materiál", () => {
    const filtered = filterMaterialsByCategory(items, null);
    const nav = getMaterialNavPosition(filtered, 3);
    expect(nav.index).toBe(1);
    expect(nav.total).toBe(3);
    expect(nav.prevId).toBe(2);
    expect(nav.nextId).toBe(1);
  });
});
