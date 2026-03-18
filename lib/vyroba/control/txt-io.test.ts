import { describe, it, expect } from "vitest";
import { parseTxtLine, formatTxtRow, exportToTxt } from "./txt-io";

describe("txt-io", () => {
  describe("parseTxtLine", () => {
    it("parsuje standardní řádek CD", () => {
      const r = parseTxtLine("05|XB|000 100|000 080", false, 20);
      expect(r).toEqual({
        ks: 15,
        serie: "XB",
        cisloOd: "000080",
        cisloDo: "000100",
      });
    });
    it("parsuje IGT řádek s predcisli", () => {
      const r = parseTxtLine("10|000|000_100|000_050", true, 20);
      expect(r?.predcisli).toBe("000");
      expect(r?.cisloOd).toBe("050");
      expect(r?.cisloDo).toBe("100");
    });
  });

  describe("formatTxtRow", () => {
    it("formátuje řádek pro CD", () => {
      const s = formatTxtRow(
        { ks: 15, serie: "XB", cisloOd: "000080", cisloDo: "000100" },
        20,
        false
      );
      expect(s).toContain("05|XB|");
    });
  });

  describe("exportToTxt", () => {
    it("exportuje řádky", () => {
      const rows = [
        { ks: 1, serie: "XB", cisloOd: "1", cisloDo: "2" },
      ];
      const txt = exportToTxt(rows, 20, false);
      expect(txt).toContain("|XB|");
    });
  });
});
