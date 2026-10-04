import { describe, expect, it } from "vitest";
import { decideScanResolution, parseEquipmentScanCode, type ScanCandidates } from "./scan-code";

describe("parseEquipmentScanCode", () => {
  it.each([
    ["INTEGRAF:EQ:123456789012", { kind: "eq", code: "123456789012" }],
    ["integraf:eq:123456789012", { kind: "eq", code: "123456789012" }],
    ["  INTEGRAF:RM:RM-084092796419 ", { kind: "rm", code: "RM-084092796419" }],
    ["123456789012", { kind: "eq", code: "123456789012" }],
    ["EQ-27429695", { kind: "eq", code: "EQ-27429695" }],
    ["RM-084092796419", { kind: "rm", code: "RM-084092796419" }],
    ["1012", { kind: "raw", code: "1012" }],
    ["100500", { kind: "raw", code: "100500" }],
    ["", { kind: "raw", code: "" }],
    ["https://appintegraf.integraf.cz/q/123456789012", { kind: "eq", code: "123456789012" }],
    ["http://192.168.10.210:3011/q/RM-084092796419", { kind: "rm", code: "RM-084092796419" }],
    ["HTTPS://APPINTEGRAF.INTEGRAF.CZ/Q/RM-084092796419?x=1", { kind: "rm", code: "RM-084092796419" }],
    ["https://appintegraf.integraf.cz/q/100500", { kind: "raw", code: "100500" }],
    ["https://appintegraf.integraf.cz/q/INTEGRAF:EQ:123456789012", { kind: "eq", code: "123456789012" }],
    ["https://appintegraf.integraf.cz/equipment/12", { kind: "raw", code: "https://appintegraf.integraf.cz/equipment/12" }],
  ] as const)("%j → %j", (raw, parsed) => {
    expect(parseEquipmentScanCode(raw)).toEqual(parsed);
  });
});

const item = { id: 501 };
const room = { id: 77 };

describe("decideScanResolution", () => {
  // Skutečná kolize v datech: inventární číslo 1012 = kód místnosti 1012 („CTP nové“).
  const collision: ScanCandidates = { itemByTag: item, room };
  const raw1012 = parseEquipmentScanCode("1012");

  it("ručně zadaný kód shodný s položkou i místností → výslovná volba (nikdy tiché přepnutí)", () => {
    expect(decideScanResolution(raw1012, collision, "any")).toEqual({ type: "ambiguous", itemId: 501, roomId: 77 });
  });

  it("kde se čeká položka (inventura, přesun), vyhraje položka", () => {
    expect(decideScanResolution(raw1012, collision, "item")).toEqual({ type: "item", itemId: 501 });
  });

  it("kde se čeká místnost, vyhraje místnost", () => {
    expect(decideScanResolution(raw1012, collision, "room")).toEqual({ type: "room", roomId: 77 });
  });

  it("QR položky (prefix EQ) nikdy nenajde místnost", () => {
    const parsed = parseEquipmentScanCode("INTEGRAF:EQ:123456789012");
    expect(decideScanResolution(parsed, { itemByQr: item }, "any")).toEqual({ type: "item", itemId: 501 });
    expect(decideScanResolution(parsed, { itemByQr: item }, "room")).toEqual({ type: "wrong_kind", found: "item" });
  });

  it("QR místnosti (prefix RM) nikdy nenajde položku", () => {
    const parsed = parseEquipmentScanCode("INTEGRAF:RM:RM-084092796419");
    expect(decideScanResolution(parsed, { room }, "any")).toEqual({ type: "room", roomId: 77 });
    expect(decideScanResolution(parsed, { room }, "item")).toEqual({ type: "wrong_kind", found: "room" });
  });

  it("u položky má přednost inventární číslo před QR kódem a sériovým číslem", () => {
    const parsed = parseEquipmentScanCode("ABC1");
    const c: ScanCandidates = { itemBySerial: { id: 3 }, itemByQr: { id: 2 }, itemByTag: { id: 1 } };
    expect(decideScanResolution(parsed, c, "item")).toEqual({ type: "item", itemId: 1 });
  });

  it("najde položku podle sériového čísla", () => {
    expect(decideScanResolution(parseEquipmentScanCode("SN-X1"), { itemBySerial: { id: 9 } }, "any")).toEqual({
      type: "item",
      itemId: 9,
    });
  });

  it("přiřazený kód z fondu vede na svou položku, volný zůstane kódem z fondu", () => {
    const parsed = parseEquipmentScanCode("INTEGRAF:EQ:111122223333");
    expect(decideScanResolution(parsed, { pool: { id: 5, status: "assigned", equipmentId: 501 } }, "item")).toEqual({
      type: "item",
      itemId: 501,
    });
    expect(decideScanResolution(parsed, { pool: { id: 5, status: "available", equipmentId: null } }, "any")).toEqual({
      type: "qr_pool",
      poolId: 5,
    });
  });

  it("znehodnocený kód z fondu ani neznámý kód nic nenajdou", () => {
    const parsed = parseEquipmentScanCode("INTEGRAF:EQ:111122223333");
    expect(decideScanResolution(parsed, { pool: { id: 5, status: "void", equipmentId: null } }, "any")).toEqual({
      type: "not_found",
    });
    expect(decideScanResolution(parseEquipmentScanCode("999"), {}, "any")).toEqual({ type: "not_found" });
  });

  it("místnost hledaná jako položka vrátí srozumitelné „špatný druh kódu“", () => {
    expect(decideScanResolution(parseEquipmentScanCode("2006"), { room }, "item")).toEqual({
      type: "wrong_kind",
      found: "room",
    });
  });
});
