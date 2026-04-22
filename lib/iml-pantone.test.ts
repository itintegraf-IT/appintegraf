import { describe, it, expect } from "vitest";
import { isValidPantoneCode, normalizePantoneCode } from "./iml-pantone";

describe("normalizePantoneCode", () => {
  it("trim, toUpperCase, collapse whitespace", () => {
    expect(normalizePantoneCode("  pantone 485 C ")).toBe("PANTONE 485 C");
  });

  it("vloží mezeru po P na začátku (P1234 → P 1234)", () => {
    expect(normalizePantoneCode("p1234")).toBe("P 1234");
  });

  it("už má mezeru za P, nechá stejně", () => {
    expect(normalizePantoneCode("P 485 C")).toBe("P 485 C");
  });

  it("prázdný string → prázdný string", () => {
    expect(normalizePantoneCode("")).toBe("");
    expect(normalizePantoneCode("   ")).toBe("");
  });

  it("sloučí tabuláty a víc mezer", () => {
    expect(normalizePantoneCode("p\t485\t c")).toBe("P 485 C");
    expect(normalizePantoneCode("P  485  C")).toBe("P 485 C");
  });

  it("bez P prefixu – jen uppercase + trim", () => {
    expect(normalizePantoneCode("black 6 c")).toBe("BLACK 6 C");
  });

  it("non-string vstup vrací prázdný string", () => {
    // @ts-expect-error - testujeme runtime robustnost
    expect(normalizePantoneCode(undefined)).toBe("");
    // @ts-expect-error
    expect(normalizePantoneCode(null)).toBe("");
  });
});

describe("isValidPantoneCode", () => {
  it("platné běžné kódy", () => {
    expect(isValidPantoneCode("P 485 C")).toBe(true);
    expect(isValidPantoneCode("PANTONE 485 C")).toBe(true);
    expect(isValidPantoneCode("BLACK 6 C")).toBe(true);
    expect(isValidPantoneCode("COOL GRAY 10 C")).toBe(true);
  });

  it("prázdný / max délka 32", () => {
    expect(isValidPantoneCode("")).toBe(false);
    expect(isValidPantoneCode("A".repeat(32))).toBe(true);
    expect(isValidPantoneCode("A".repeat(33))).toBe(false);
  });

  it("nepovolené znaky", () => {
    expect(isValidPantoneCode("P 485 c")).toBe(false); // lowercase
    expect(isValidPantoneCode("P_485")).toBe(false); // underscore
    expect(isValidPantoneCode("P.485")).toBe(false); // tečka
    expect(isValidPantoneCode("P@485")).toBe(false);
  });
});
