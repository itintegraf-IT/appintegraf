import { describe, expect, it } from "vitest";
import { pantoneRowsFromPrintColorsText } from "./iml-print-colors-from-text";

describe("pantoneRowsFromPrintColorsText", () => {
  it("parsuje Pantone s pokrytím", () => {
    expect(pantoneRowsFromPrintColorsText("P 7621 C 50%")).toEqual([
      { code: "P 7621 C", coverage_pct: "50" },
    ]);
  });

  it("přeskočí CMYK a vezme Pantone", () => {
    expect(pantoneRowsFromPrintColorsText("CMYK + P 485 C 30%")).toEqual([
      { code: "P 485 C", coverage_pct: "30" },
    ]);
  });

  it("vrátí prázdné pro null", () => {
    expect(pantoneRowsFromPrintColorsText(null)).toEqual([]);
  });
});
