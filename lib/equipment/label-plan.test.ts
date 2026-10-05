import { describe, expect, it } from "vitest";
import { parseLabelIds, sortItemsForLabels, sortRoomsForLabels, splitPrintable } from "./label-plan";

describe("parseLabelIds", () => {
  it("vezme celá kladná čísla, odstraní duplicity a zachová pořadí", () => {
    expect(parseLabelIds([3, "1", 3, "x", -2, 2.5, 7])).toEqual({ ok: true, ids: [3, 1, 7] });
  });

  it("prázdný výběr je chyba", () => {
    expect(parseLabelIds([])).toEqual({ ok: false, error: "Vyberte, co chcete tisknout." });
    expect(parseLabelIds("abc")).toEqual({ ok: false, error: "Vyberte, co chcete tisknout." });
  });

  it("víc než 500 najednou je chyba", () => {
    const many = Array.from({ length: 501 }, (_, i) => i + 1);
    expect(parseLabelIds(many)).toEqual({ ok: false, error: "Najednou lze tisknout nejvýše 500 štítků." });
  });

  it("víc než 500 hodnot v požadavku je chyba, i když se opakují", () => {
    const repeated = Array.from({ length: 600 }, (_, i) => (i % 3) + 1);
    expect(parseLabelIds(repeated)).toEqual({ ok: false, error: "Najednou lze tisknout nejvýše 500 štítků." });
  });

  it("obří výběr odmítne hned, bez dlouhého počítání (server se nezasekne)", () => {
    const huge = Array.from({ length: 50_000 }, (_, i) => i + 1);
    const started = performance.now();
    expect(parseLabelIds(huge).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(100);
  });
});

describe("splitPrintable", () => {
  it("položky bez QR kódu oddělí jako přeskočené", () => {
    const items = [
      { id: 1, qr_code: "111" },
      { id: 2, qr_code: null },
      { id: 3, qr_code: "" },
      { id: 4, qr_code: "444" },
    ];
    const { printable, skipped } = splitPrintable(items);
    expect(printable.map((i) => i.id)).toEqual([1, 4]);
    expect(skipped.map((i) => i.id)).toEqual([2, 3]);
  });
});

describe("sortItemsForLabels", () => {
  it("řadí po místnostech (bez místnosti na konec), uvnitř podle inventárního čísla", () => {
    const items = [
      { id: 1, roomName: "Sklad", assetTag: "100010" },
      { id: 2, roomName: null, assetTag: "100001" },
      { id: 3, roomName: "Recepce", assetTag: "100200" },
      { id: 4, roomName: "Recepce", assetTag: "1012" },
      { id: 5, roomName: "Účtárna", assetTag: "100005" },
      { id: 6, roomName: "Sklad", assetTag: null },
    ];
    expect(sortItemsForLabels(items).map((i) => i.id)).toEqual([4, 3, 1, 6, 5, 2]);
  });
});

describe("sortRoomsForLabels", () => {
  it("řadí místnosti podle kódu (číselně)", () => {
    const rooms = [{ id: 1, code: "2005" }, { id: 2, code: "1012" }, { id: 3, code: "30004" }, { id: 4, code: "1002" }];
    expect(sortRoomsForLabels(rooms).map((r) => r.id)).toEqual([4, 2, 1, 3]);
  });
});
