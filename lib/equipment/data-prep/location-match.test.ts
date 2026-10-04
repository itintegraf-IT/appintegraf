import { describe, expect, it } from "vitest";
import { parseLocation, parseRoomAliases, planRoomAssignments, type PlanItem, type PlanRoom } from "./location-match";

describe("parseLocation", () => {
  it.each([
    [null, { kind: "empty" }],
    ["   ", { kind: "empty" }],
    ["Recepce hlavní vstup (1001)", { kind: "coded", name: "Recepce hlavní vstup", code: "1001" }],
    ["Obchod - ČSOB ( 2005 )", { kind: "coded", name: "Obchod - ČSOB", code: "2005" }],
    ["tiskarna (s20000)", { kind: "costCenter", name: "tiskarna", code: "s20000" }],
    ["Velín (0)", { kind: "text", name: "Velín" }],
    ["1056 – Hala H2", { kind: "coded", name: "Hala H2", code: "1056" }],
    ["Elektro", { kind: "text", name: "Elektro" }],
  ] as const)("%j → %j", (raw, parsed) => {
    expect(parseLocation(raw)).toEqual(parsed);
  });
});

describe("parseRoomAliases", () => {
  it("vezme názvy za „Také:“ oddělené středníkem", () => {
    expect(parseRoomAliases("Také: CTP staré;  Ripovna ")).toEqual(["CTP staré", "Ripovna"]);
  });

  it("bez aliasů", () => {
    expect(parseRoomAliases(null)).toEqual([]);
    expect(parseRoomAliases("Popis místnosti")).toEqual([]);
  });
});

const rooms: PlanRoom[] = [
  { id: 1, code: "1001", name: "Recepce hlavní vstup", description: null, is_active: true },
  { id: 2, code: "1012", name: "CTP nové", description: "Také: CTP staré; Ripovna", is_active: true },
  { id: 3, code: "2013", name: "Kancelář ředitele", description: null, is_active: true },
  { id: 4, code: "2031", name: "Kancelář ředitele", description: null, is_active: true },
  { id: 5, code: "1041", name: "Hala H4", description: null, is_active: true },
  { id: 6, code: "1099", name: "Neaktivní sklad", description: null, is_active: false },
];

const item = (id: number, location: string | null, extra: Partial<PlanItem> = {}): PlanItem => ({
  id,
  location,
  room_id: null,
  status: "skladem",
  ...extra,
});

describe("planRoomAssignments", () => {
  const plan = planRoomAssignments(
    [
      item(10, "Recepce hlavní vstup (1001)"),
      item(11, "recepce  HLAVNÍ vstup (1001)"),
      item(12, "Ripovna (1012)"),
      item(13, "Kancelář ředitele (2013)"),
      item(14, "Kancelář ředitele"),
      item(15, "Hala H4 (1075)"),
      item(16, "Úplně jiný název (1001)"),
      item(17, "tiskarna (s20000)"),
      item(18, "tiskarna (s20000)"),
      item(19, null),
      item(20, "Recepce hlavní vstup (1001)", { room_id: 1 }),
      item(21, "Recepce hlavní vstup (1001)", { status: "vyřazeno" }),
      item(22, "Recepce hlavní vstup (0)"),
      item(23, "Neaktivní sklad (1099)"),
      item(24, "Mobily (30005)"),
      item(25, "1001 – Recepce hlavní vstup"),
      item(26, "Recepce hlavní vstup (1001)", { status: null }),
    ],
    rooms
  );
  const auto = Object.fromEntries(plan.auto.map((p) => [p.itemId, p]));
  const suggest = Object.fromEntries(plan.suggest.map((p) => [p.itemId, p]));

  it("kód i název sedí → automaticky (i s jinou velikostí písmen a NBSP)", () => {
    expect(auto[10]).toMatchObject({ roomId: 1, reason: "code_name" });
    expect(auto[11]).toMatchObject({ roomId: 1, reason: "code_name" });
    expect(auto[25]).toMatchObject({ roomId: 1, reason: "code_name" });
  });

  it("kód sedí a název je dřívější název sloučené místnosti → automaticky", () => {
    expect(auto[12]).toMatchObject({ roomId: 2, reason: "code_alias" });
  });

  it("kód rozhoduje i u dvou místností se stejným názvem", () => {
    expect(auto[13]).toMatchObject({ roomId: 3 });
  });

  it("stav NULL není vyřazená položka", () => {
    expect(auto[26]).toMatchObject({ roomId: 1 });
  });

  it("neznámý kód s jednoznačným názvem a „(0)“ → návrh", () => {
    expect(suggest[15]).toMatchObject({ roomId: 5, reason: "name_only" });
    expect(suggest[22]).toMatchObject({ roomId: 1, reason: "name_only" });
  });

  it("kód sedí, ale název ne → návrh, ne automaticky", () => {
    expect(suggest[16]).toMatchObject({ roomId: 1, reason: "code_name_differs" });
    expect(auto[16]).toBeUndefined();
  });

  it("nejednoznačný název, středisko, prázdné, neaktivní místnost a neznámé místo zůstanou ve skupinách", () => {
    for (const id of [14, 17, 18, 19, 23, 24]) {
      expect(auto[id]).toBeUndefined();
      expect(suggest[id]).toBeUndefined();
    }
    const byLabel = Object.fromEntries(plan.groups.map((g) => [g.label, g]));
    expect(byLabel["tiskarna (s20000)"]).toMatchObject({ kind: "costCenter", count: 2, itemIds: [17, 18] });
    expect(byLabel["Bez umístění"]).toMatchObject({ kind: "empty", count: 1, itemIds: [19] });
    expect(byLabel["Kancelář ředitele"]).toMatchObject({ count: 1, itemIds: [14] });
    expect(byLabel["Mobily (30005)"]).toMatchObject({ count: 1, itemIds: [24] });
    expect(byLabel["Neaktivní sklad (1099)"]).toMatchObject({ count: 1, itemIds: [23] });
  });

  it("už zařazené a vyřazené přeskočí", () => {
    expect(plan.skipped).toEqual({ alreadyPlaced: 1, retired: 1 });
    expect(auto[20]).toBeUndefined();
    expect(auto[21]).toBeUndefined();
  });

  it("skupiny jsou seřazené od největší", () => {
    expect(plan.groups[0].count).toBeGreaterThanOrEqual(plan.groups[plan.groups.length - 1].count);
  });
});
