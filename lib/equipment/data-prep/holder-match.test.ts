import { describe, expect, it } from "vitest";
import {
  classifyHolderMatch,
  parseNoteHolder,
  planHolderAssignments,
  stripPersonTitles,
  type HolderItem,
  type HolderUser,
} from "./holder-match";

// Smyšlená jména — testy nesmí obsahovat skutečné osoby.
const users: HolderUser[] = [
  { id: 1, first_name: "Jan", last_name: "Novák" },
  { id: 2, first_name: "Petra", last_name: "Svobodová" },
  { id: 3, first_name: "Karel", last_name: "Dvořák" },
  { id: 4, first_name: "Eva", last_name: "Dvořák" },
  { id: 5, first_name: "Tomáš", last_name: "Černý" },
];

describe("parseNoteHolder", () => {
  it("vezme jméno z řádku „Pracovník:“", () => {
    expect(parseNoteHolder("Pracovník: Novák Jan\nStředisko: Výroba")).toBe("Novák Jan");
    expect(parseNoteHolder("Středisko: Výroba\nPracovník:  tiskárna ")).toBe("tiskárna");
  });

  it("bez řádku nebo prázdné → null", () => {
    expect(parseNoteHolder("Středisko: Výroba")).toBeNull();
    expect(parseNoteHolder("Pracovník: ")).toBeNull();
    expect(parseNoteHolder(null)).toBeNull();
  });
});

describe("stripPersonTitles", () => {
  it.each([
    ["Ing. Petra Svobodová", "Petra Svobodová"],
    ["Mgr.Petra Svobodová", "Petra Svobodová"],
    ["Tomáš Černý, Ph.D.", "Tomáš Černý"],
    ["Novák Jan DiS.", "Novák Jan"],
    ["Bc. Ing. Jan Novák", "Jan Novák"],
  ] as const)("%s → %s", (raw, expected) => {
    expect(stripPersonTitles(raw)).toBe(expected);
  });
});

describe("classifyHolderMatch", () => {
  it.each([
    ["Novák Jan", { kind: "full", userId: 1 }],
    ["Jan Novák", { kind: "full", userId: 1 }],
    ["Ing. Petra Svobodová", { kind: "full", userId: 2 }],
    ["SVOBODOVÁ", { kind: "surname", userId: 2 }],
    ["Dvořák", { kind: "ambiguous", userIds: [3, 4] }],
    ["tiskárna", { kind: "none" }],
    ["Novák / Černý", { kind: "none" }],
  ] as const)("%s → %j", (raw, expected) => {
    expect(classifyHolderMatch(raw, users)).toEqual(expected);
  });
});

const item = (id: number, notes: string | null, extra: Partial<HolderItem> = {}): HolderItem => ({
  id,
  name: `Položka ${id}`,
  notes,
  status: "skladem",
  hasOpenAssignment: false,
  ...extra,
});

describe("planHolderAssignments", () => {
  const plan = planHolderAssignments(
    [
      item(1, "Pracovník: Novák Jan\nStředisko: Výroba"),
      item(2, "Pracovník: Ing. Petra Svobodová"),
      item(3, "Pracovník: Svobodová"),
      item(4, "Pracovník: Dvořák"),
      item(5, "Pracovník: tiskárna"),
      item(6, "Pracovník: tiskárna"),
      item(7, "Středisko: Výroba"),
      item(8, "Pracovník: Novák Jan", { status: "přiřazeno" }),
      item(9, "Pracovník: Novák Jan", { hasOpenAssignment: true }),
      item(10, "Pracovník: Černý Tomáš", { name: "Mobil  Samsung" }),
    ],
    users,
    [{ userId: 5, itemName: "mobil samsung" }]
  );
  const rows = Object.fromEntries(plan.rows.map((r) => [r.itemId, r]));

  it("celé jméno i shoda podle příjmení dostanou řádek s druhem shody", () => {
    expect(rows[1]).toMatchObject({ userId: 1, kind: "full", holderText: "Novák Jan" });
    expect(rows[2]).toMatchObject({ userId: 2, kind: "full" });
    expect(rows[3]).toMatchObject({ userId: 2, kind: "surname" });
  });

  it("držitel už má otevřenou položku se stejným názvem → varování (duplicita)", () => {
    expect(rows[10]).toMatchObject({ userId: 5, kind: "full", warning: "same_name_holder" });
    expect(rows[1].warning).toBeUndefined();
  });

  it("nejednoznačné a nenalezené jsou ve skupinách, ne v řádcích", () => {
    expect(rows[4]).toBeUndefined();
    expect(rows[5]).toBeUndefined();
    const byLabel = Object.fromEntries(plan.groups.map((g) => [g.label, g]));
    expect(byLabel["Dvořák"]).toMatchObject({ kind: "ambiguous", count: 1, itemIds: [4] });
    expect(byLabel["tiskárna"]).toMatchObject({ kind: "none", count: 2, itemIds: [5, 6] });
  });

  it("položky mimo sklad nebo s otevřeným přiřazením přeskočí; bez „Pracovník:“ ignoruje", () => {
    expect(plan.skipped).toEqual({ notInStock: 1, alreadyAssigned: 1 });
    expect(rows[7]).toBeUndefined();
    expect(rows[8]).toBeUndefined();
    expect(rows[9]).toBeUndefined();
  });
});
