import { describe, expect, it, vi } from "vitest";
import type { PrismaTransactionClient } from "@/lib/db";
import {
  allocateAssetTags,
  firstAllowedSeriesStart,
  isRetryableAllocationError,
  manualTagSeriesConflict,
  nextSeriesTags,
  parseAssetTagSeries,
  setAssetTagSeriesStart,
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

describe("manualTagSeriesConflict — ruční číslo nesmí zasáhnout do řady", () => {
  const series = { start: 100876, lastIssued: 100880 };

  it("číslo z Gen mimo tvar řady projde", () => {
    expect(manualTagSeriesConflict("1215", { series, maxInDb: 100880 })).toBeNull();
  });

  it("starší číslo pod startem řady projde (dohledaný drobný majetek z Gen)", () => {
    expect(manualTagSeriesConflict("100500", { series, maxInDb: 100880 })).toBeNull();
  });

  it.each([
    ["už vydané číslo (položka mezitím smazaná)", "100878"],
    ["start řady", "100876"],
    ["překlep, který by řadu posunul o tisíce čísel", "108750"],
  ])("odmítne %s", (_label, tag) => {
    expect(manualTagSeriesConflict(tag, { series, maxInDb: 100880 })).toMatch(/100876/);
  });

  it("bez nastavené řady odmítne čísla nad nejvyšším použitým (budoucí řada)", () => {
    expect(manualTagSeriesConflict("100500", { series: null, maxInDb: 100875 })).toBeNull();
    expect(manualTagSeriesConflict("100876", { series: null, maxInDb: 100875 })).toMatch(/není nastavená/);
  });
});

/** Maketa transakce: zaznamená pořadí příkazů; `FOR UPDATE` = zámek řádku nastavení řady. */
function fakeTx(settingValue: string | null, maxInDb: number | null) {
  const calls: string[] = [];
  const upsert = vi.fn(async (args: unknown) => {
    calls.push("upsert");
    return args;
  });
  const update = vi.fn(async (args: unknown) => {
    calls.push("update");
    return args;
  });
  const tx = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join("?");
      if (sql.includes("FOR UPDATE")) {
        calls.push("lock");
        return settingValue === null ? [] : [{ setting_value: settingValue }];
      }
      calls.push("max");
      return [{ max: maxInDb === null ? null : BigInt(maxInDb) }];
    }),
    system_settings: {
      findUnique: vi.fn(async () => {
        calls.push("read-bez-zamku");
        return settingValue === null ? null : { setting_value: settingValue };
      }),
      upsert,
      update,
    },
  };
  return { tx: tx as unknown as PrismaTransactionClient, calls, upsert, update };
}

describe("setAssetTagSeriesStart — změna startu pod zámkem řady", () => {
  it("zamkne řadu prvním příkazem a zachová poslední vydané číslo přečtené pod zámkem", async () => {
    const { tx, calls, upsert } = fakeTx('{"start":100876,"lastIssued":100880}', 100880);
    const res = await setAssetTagSeriesStart(tx, 100900, 1);
    expect(res).toEqual({ ok: true, start: 100900, previous: { start: 100876, lastIssued: 100880 } });
    expect(calls[0]).toBe("lock");
    expect(calls).not.toContain("read-bez-zamku");
    const args = upsert.mock.calls[0][0] as { update: { setting_value: string } };
    expect(JSON.parse(args.update.setting_value)).toEqual({ start: 100900, lastIssued: 100880 });
  });

  it("odmítne start, který by znovu vydal už vydané číslo", async () => {
    const { tx, upsert } = fakeTx('{"start":100876,"lastIssued":100880}', 100879);
    const res = await setAssetTagSeriesStart(tx, 100880, 1);
    expect(res.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("první nastavení řadu založí", async () => {
    const { tx, upsert } = fakeTx(null, 100875);
    const res = await setAssetTagSeriesStart(tx, "100876", 1);
    expect(res).toEqual({ ok: true, start: 100876, previous: null });
    const args = upsert.mock.calls[0][0] as { create: { setting_value: string } };
    expect(JSON.parse(args.create.setting_value)).toEqual({ start: 100876, lastIssued: null });
  });
});

describe("allocateAssetTags", () => {
  it("zamkne řadu prvním příkazem a uloží poslední vydané číslo", async () => {
    const { tx, calls, update } = fakeTx('{"start":100876,"lastIssued":100880}', 100880);
    await expect(allocateAssetTags(tx, 2)).resolves.toEqual(["100881", "100882"]);
    expect(calls[0]).toBe("lock");
    const args = update.mock.calls[0][0] as { data: { setting_value: string } };
    expect(JSON.parse(args.data.setting_value)).toEqual({ start: 100876, lastIssued: 100882 });
  });
});
