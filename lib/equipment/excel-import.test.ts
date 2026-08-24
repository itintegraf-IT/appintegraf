import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  matchResponsibleUser,
  parseEquipmentExcelBuffer,
  parseEquipmentWorkbook,
  slugCategoryCode,
  uniqueCategoryCode,
  formatOriginalLocation,
  formatItemNotes,
  yearToPurchaseDate,
} from "@/lib/equipment/excel-import";

function bookFromSheets(sheets: Record<string, unknown[][]>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  }
  return wb;
}

const MAJETEK_HEADER = [
  "Inv.číslo",
  "KATEGORIE",
  "ZODPOVĚDNÁ OSOBA",
  "Název",
  "Rok",
  "Ks",
  "Název místnosti",
  "Místnost",
  "Jméno pracovníka",
  "Název střediska",
  "Doplňující údaje",
];

describe("slugCategoryCode", () => {
  it("odstraní diakritiku a zkrátí na 20 znaků", () => {
    expect(slugCategoryCode("AV technika")).toBe("AV_TECHNIKA");
    expect(slugCategoryCode("Stroje – tiskové a výrobní").startsWith("STROJE")).toBe(true);
    expect(slugCategoryCode("Bílá elektrotechnika").length).toBeLessThanOrEqual(20);
  });

  it("doplní číslo při kolizi kódu", () => {
    const taken = new Set(["AUTA"]);
    expect(uniqueCategoryCode("Auta", taken)).toBe("AUTA_2");
  });
});

describe("matchResponsibleUser", () => {
  const users = [
    { id: 1, first_name: "Michal", last_name: "Osoba" },
    { id: 2, first_name: "Petr", last_name: "Michalčík" },
    { id: 3, first_name: "Roman", last_name: "Fiedler" },
    { id: 4, first_name: "Jan", last_name: "Novák" },
    { id: 5, first_name: "Eva", last_name: "Novák" },
  ];

  it("páruje Příjmení Jméno", () => {
    expect(matchResponsibleUser("Osoba Michal", users).userId).toBe(1);
  });

  it("páruje jednoznačné příjmení", () => {
    expect(matchResponsibleUser("Fiedler", users).userId).toBe(3);
  });

  it("nespáruje dvojici se lomítkem", () => {
    const r = matchResponsibleUser("Kosař / Horký Radek", users);
    expect(r.userId).toBeNull();
    expect(r.warning).toMatch(/jednoznačně/);
  });

  it("nespáruje nejednoznačné příjmení", () => {
    const r = matchResponsibleUser("Novák", users);
    expect(r.userId).toBeNull();
    expect(r.warning).toMatch(/není jednoznačné/);
  });
});

describe("formatOriginalLocation / notes", () => {
  it("složí nápovědu umístění", () => {
    expect(formatOriginalLocation("Archív účtárna", "2035")).toBe("Archív účtárna (2035)");
    expect(formatOriginalLocation("", "")).toBeNull();
  });

  it("složí poznámky bez Ks", () => {
    expect(
      formatItemNotes({ workerName: "Tokan", costCenter: "Administrativa", extra: "" })
    ).toBe("Pracovník: Tokan\nStředisko: Administrativa");
  });
});

describe("yearToPurchaseDate", () => {
  it("uloží 1. leden UTC", () => {
    expect(yearToPurchaseDate(2017)?.toISOString()).toBe("2017-01-01T00:00:00.000Z");
    expect(yearToPurchaseDate(null)).toBeNull();
  });
});

describe("parseEquipmentWorkbook", () => {
  it("parsuje 3 záložky, přeskočí NEPŘENÁŠÍME a sloučí duplicitní nový kód", () => {
    const wb = bookFromSheets({
      majetek: [
        MAJETEK_HEADER,
        [
          "88091",
          "Auta",
          "Sychrovský",
          "AUDI Q7",
          "2017",
          "1",
          "Archív účtárna",
          "2035",
          "Tokan                         ",
          "Administrativa",
          "",
        ],
        ["1001", "Nářadí", "Andrž Josef", "Židle", "2020", "5", "", "", "", "Výroba", ""],
        ["1001", "Nářadí", "Andrž Josef", "Duplicita", "2020", "1", "", "", "", "", ""],
      ],
      místnosti: [
        ["Název", "Místnost", "nový kód"],
        ["NEZAŘAZENO", "Původní", "místností"],
        ["Recepce hlavní vstup", "10001", "1001"],
        ["CTP nové", "10012", "1012"],
        ["CTP staré", "10013", "1012"],
        ["stará označení - NEPŘENÁŠÍME", "", ""],
        ["Automobily", "30001", ""],
        ["tiskarna", "s20000", ""],
      ],
      kategorie: [
        ["ČÍSELNÍK — kategorie a zodpovědné osoby (dle schůzky 10.7.2026)", ""],
        ["", ""],
        ["KATEGORIE", "ZODPOVĚDNÁ OSOBA"],
        ["Auta", "Sychrovský"],
        ["Nářadí", "Andrž Josef"],
      ],
    });

    const parsed = parseEquipmentWorkbook(wb);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].assetTag).toBe("88091");
    expect(parsed.items[0].location).toBe("Archív účtárna (2035)");
    expect(parsed.items[0].notes).toContain("Tokan");
    expect(parsed.items[1].quantity).toBe(5);
    expect(parsed.warnings.some((w) => w.includes("duplicitní"))).toBe(true);

    expect(parsed.rooms.map((r) => r.code).sort()).toEqual(["1001", "1012"]);
    const ctp = parsed.rooms.find((r) => r.code === "1012");
    expect(ctp?.name).toBe("CTP nové");
    expect(ctp?.aliases).toContain("CTP staré");

    expect(parsed.categories.map((c) => c.name)).toEqual(["Auta", "Nářadí"]);
  });

  it("pozná přejmenované listy podle hlaviček a odvodí chybějící kategorii z majetku", () => {
    const wb = bookFromSheets({
      Sheet1: [
        MAJETEK_HEADER,
        ["42", "Regály", "", "Policový regál", "2015", "2", "Hala IG1", "1020", "", "Výroba", ""],
      ],
      rooms: [
        ["Název", "Místnost", "nový kód"],
        ["Hala IG1", "10023", "1020"],
      ],
    });
    const parsed = parseEquipmentWorkbook(wb);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.categories.map((c) => c.name)).toEqual(["Regály"]);
    expect(parsed.rooms[0].code).toBe("1020");
    expect(parsed.warnings.some((w) => w.includes("kategorií"))).toBe(true);
  });

  it("parsuje buffer xlsx", () => {
    const wb = bookFromSheets({
      majetek: [
        MAJETEK_HEADER,
        ["9", "Auta", "", "Test auto", "2021", "1", "", "", "", "", ""],
      ],
    });
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const parsed = parseEquipmentExcelBuffer(buf);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].assetTag).toBe("9");
  });

  it("vrátí chybu bez listu majetku", () => {
    const wb = bookFromSheets({
      x: [["Název", "Místnost", "nový kód"], ["Recepce", "10001", "1001"]],
    });
    const parsed = parseEquipmentWorkbook(wb);
    expect(parsed.items).toHaveLength(0);
    expect(parsed.errors[0]).toMatch(/záložka majetku/i);
  });
});
