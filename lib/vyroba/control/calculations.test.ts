import { describe, it, expect } from "vitest";
import {
  formatCislo,
  koncCisloRole,
  posunIGT,
  posunCD,
  initialCisla,
  initialRowsForJob,
  getCiselNaRoli,
} from "./calculations";

describe("calculations", () => {
  describe("formatCislo", () => {
    it("formátuje číslo s mezerami", () => {
      expect(formatCislo(1234567, 7)).toBe("1 234 567");
    });
  });

  describe("koncCisloRole", () => {
    it("vypočítá poslední číslo na roli", () => {
      expect(koncCisloRole(1000, 1000)).toBe(1);
      expect(koncCisloRole(100, 50)).toBe(51);
    });
  });

  describe("posunIGT", () => {
    it("zpět zvyšuje čísla", () => {
      const r = posunIGT(100, 50, "zpet", 10);
      expect(r.cisloOd).toBe(110);
      expect(r.cisloDo).toBe(60);
    });
    it("vpřed snižuje čísla", () => {
      const r = posunIGT(100, 50, "vpred", 10);
      expect(r.cisloOd).toBe(90);
      expect(r.cisloDo).toBe(40);
    });
  });

  describe("posunCD", () => {
    it("skip = ciselNaRoli * prod", () => {
      const r = posunCD(1000, 1, 1000, 6, "zpet");
      expect(r.cisloOd).toBe(7000); // 1000 + 6000
      expect(r.cisloDo).toBe(6001);
    });
  });

  describe("initialCisla", () => {
    it("vypočítá první roli", () => {
      const r = initialCisla(1000, 1000, 4);
      expect(r.cisloOd).toBe("1 000");
      expect(r.cisloDo).toBe("0 000"); // formatCislo(0, 4) = "0000" -> "0 000"
    });
  });

  describe("initialRowsForJob", () => {
    it("CD_POP – stejné řádky pro všechny produkce", () => {
      const rows = initialRowsForJob("CD_POP", 999, 1000, 6, 0, 7);
      expect(rows.length).toBe(6);
      expect(rows[0].cisloOd).toBe(rows[1].cisloOd);
    });
  });

  describe("getCiselNaRoli", () => {
    it("vrací fixní hodnotu pro CD_Vnitro", () => {
      expect(getCiselNaRoli("CD_Vnitro", null)).toBe(1000);
    });
    it("vrací pocetCnaRoli pro CD_POP (variabilní)", () => {
      expect(getCiselNaRoli("CD_POP", 180)).toBe(180);
      expect(getCiselNaRoli("CD_POP", null)).toBe(180); // default
    });
  });
});
