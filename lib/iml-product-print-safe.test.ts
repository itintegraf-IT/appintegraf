import { describe, expect, it } from "vitest";
import {
  imlProductPrintSafeFlag,
  imlProductPrintWarning,
  isImlProductPrintSafe,
} from "@/lib/iml-product-print-safe";

describe("iml-product-print-safe", () => {
  it("jen aktivní je print-safe", () => {
    expect(isImlProductPrintSafe("aktivní")).toBe(true);
    expect(isImlProductPrintSafe(" aktivní ")).toBe(true);
    expect(isImlProductPrintSafe("neaktivní")).toBe(false);
    expect(isImlProductPrintSafe("Změna dat")).toBe(false);
    expect(isImlProductPrintSafe(null)).toBe(false);
    expect(isImlProductPrintSafe("")).toBe(false);
  });

  it("flag a warning", () => {
    expect(imlProductPrintSafeFlag("aktivní")).toBe("true");
    expect(imlProductPrintSafeFlag("neaktivní")).toBe("false");
    expect(imlProductPrintWarning("aktivní")).toBe("");
    expect(imlProductPrintWarning("neaktivní")).toBe(
      "POZOR: produkt není aktivní (stav: neaktivní)"
    );
    expect(imlProductPrintWarning(null, { productMissing: true })).toBe(
      "POZOR: chybí produkt"
    );
  });
});
