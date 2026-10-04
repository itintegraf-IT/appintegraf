import { describe, expect, it } from "vitest";
import { normalizeForMatch, stripDiacritics } from "./text-normalize";

describe("stripDiacritics", () => {
  it("odstraní háčky a čárky", () => {
    expect(stripDiacritics("Kancelář finanční ředitel")).toBe("Kancelar financni reditel");
  });
});

describe("normalizeForMatch", () => {
  it("malá písmena, bez diakritiky, jedna mezera, oříznutí", () => {
    expect(normalizeForMatch("  Kancelář   finanční ředitel ")).toBe("kancelar financni reditel");
  });

  it("různé pomlčky sjednotí včetně mezer kolem", () => {
    expect(normalizeForMatch("Velín – technologie")).toBe("velin - technologie");
    expect(normalizeForMatch("Velín—technologie")).toBe("velin - technologie");
    expect(normalizeForMatch("Obchod - ČSOB")).toBe("obchod - csob");
  });

  it("pomlčka uvnitř slova bez mezer zůstane", () => {
    expect(normalizeForMatch("trezor-diskety")).toBe("trezor-diskety");
  });

  it("prázdný vstup", () => {
    expect(normalizeForMatch("")).toBe("");
  });
});
