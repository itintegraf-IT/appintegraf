import { describe, expect, it } from "vitest";
import {
  firstAllowedSeriesStart,
  isRetryableAllocationError,
  nextSeriesTags,
  parseAssetTagSeries,
  uniqueConstraintIndex,
  validateSeriesStart,
} from "./asset-number";

describe("nextSeriesTags", () => {
  it("první číslo nové řady = nastavený start", () => {
    expect(nextSeriesTags({ start: 100876, lastIssued: null, maxInDb: 100875, count: 1 })).toEqual(["100876"]);
  });

  it("navazuje na poslední vydané číslo", () => {
    expect(nextSeriesTags({ start: 100876, lastIssued: 100880, maxInDb: 100880, count: 1 })).toEqual(["100881"]);
  });

  it("číslo smazané položky se znovu nepoužije (rozhoduje poslední vydané, ne maximum v DB)", () => {
    expect(nextSeriesTags({ start: 100876, lastIssued: 100880, maxInDb: 100879, count: 1 })).toEqual(["100881"]);
  });

  it("ručně zadané vyšší číslo v řadě posune další přidělení za něj", () => {
    expect(nextSeriesTags({ start: 100876, lastIssued: 100880, maxInDb: 100950, count: 1 })).toEqual(["100951"]);
  });

  it("víc kusů dostane po sobě jdoucí čísla", () => {
    expect(nextSeriesTags({ start: 100876, lastIssued: null, maxInDb: 100875, count: 3 })).toEqual([
      "100876",
      "100877",
      "100878",
    ]);
  });

  it("start vyšší než cokoli v DB má přednost", () => {
    expect(nextSeriesTags({ start: 101000, lastIssued: null, maxInDb: 100875, count: 1 })).toEqual(["101000"]);
  });

  it("přetečení řady odmítne", () => {
    expect(() => nextSeriesTags({ start: 199999, lastIssued: 199999, maxInDb: 199999, count: 1 })).toThrow();
  });
});

describe("parseAssetTagSeries", () => {
  it("načte uložené nastavení", () => {
    expect(parseAssetTagSeries('{"start":100876,"lastIssued":100880}')).toEqual({ start: 100876, lastIssued: 100880 });
    expect(parseAssetTagSeries('{"start":100876,"lastIssued":null}')).toEqual({ start: 100876, lastIssued: null });
  });

  it.each([null, "", "nesmysl", '{"start":"abc"}', '{"start":99999}', '{"start":200000}'])(
    "neplatné nebo chybějící nastavení %j = řada není nastavená",
    (value) => {
      expect(parseAssetTagSeries(value)).toBeNull();
    }
  );
});

/** Chyba přesně ve tvaru, jak ji vrací Prisma 7 s @prisma/adapter-mariadb (ověřeno na lokální DB). */
function uniqueError(index: string, message: string) {
  return Object.assign(new Error("Unique constraint failed"), {
    code: "P2002",
    meta: {
      modelName: "equipment_items",
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: {
          originalCode: "1062",
          originalMessage: message,
          kind: "UniqueConstraintViolation",
          constraint: { index },
        },
      },
    },
  });
}

describe("uniqueConstraintIndex / isRetryableAllocationError", () => {
  const assetTagDup = uniqueError(
    "equipment_items_asset_tag_unique",
    "Duplicate entry '100500' for key 'equipment_items.equipment_items_asset_tag_unique'"
  );
  const serialDup = uniqueError("serial_number", "Duplicate entry 'X1' for key 'equipment_items.serial_number'");

  it("pozná index, na kterém kolize vznikla", () => {
    expect(uniqueConstraintIndex(assetTagDup)).toBe("equipment_items_asset_tag_unique");
    expect(uniqueConstraintIndex(serialDup)).toBe("serial_number");
    expect(uniqueConstraintIndex(new Error("jiná chyba"))).toBeNull();
  });

  it("bez constraint.index vezme název indexu ze zprávy databáze (formát MariaDB)", () => {
    const e = uniqueError("", "Duplicate entry '100500' for key 'equipment_items_asset_tag_unique'");
    (e.meta.driverAdapterError.cause as { constraint?: unknown }).constraint = undefined;
    expect(uniqueConstraintIndex(e)).toBe("equipment_items_asset_tag_unique");
  });

  it("opakuje se jen kolize čísla řady a deadlock, ne sériové číslo", () => {
    expect(isRetryableAllocationError(assetTagDup)).toBe(true);
    expect(
      isRetryableAllocationError(uniqueError("equipment_qr_pool_tag_unique", "Duplicate entry for key 'equipment_qr_pool_tag_unique'"))
    ).toBe(true);
    expect(isRetryableAllocationError(Object.assign(new Error("deadlock"), { code: "P2034" }))).toBe(true);
    expect(isRetryableAllocationError(serialDup)).toBe(false);
    expect(isRetryableAllocationError(new Error("jiná chyba"))).toBe(false);
  });
});

describe("nastavení startu řady", () => {
  it("nejnižší povolený start je za nejvyšším použitým i vydaným číslem", () => {
    expect(firstAllowedSeriesStart({ maxInDb: 100875, lastIssued: null })).toBe(100876);
    expect(firstAllowedSeriesStart({ maxInDb: 100875, lastIssued: 100890 })).toBe(100891);
    expect(firstAllowedSeriesStart({ maxInDb: null, lastIssued: null })).toBe(100000);
  });

  it("přijme celé číslo v řadě od povoleného minima", () => {
    expect(validateSeriesStart(100876, 100876)).toEqual({ ok: true, start: 100876 });
    expect(validateSeriesStart("100900", 100876)).toEqual({ ok: true, start: 100900 });
  });

  it.each([
    ["nižší než poslední použité", 100875],
    ["mimo řadu 100000–199999", 200000],
    ["desetinné", 100876.5],
    ["text", "abc"],
    ["prázdné", ""],
  ])("odmítne start: %s", (_label, value) => {
    expect(validateSeriesStart(value, 100876).ok).toBe(false);
  });
});
