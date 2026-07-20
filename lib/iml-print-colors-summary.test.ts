import { describe, expect, it } from "vitest";
import { formatPrintColorsSummaryForDisplay } from "./iml-print-colors-summary";

describe("formatPrintColorsSummaryForDisplay", () => {
  it("odstraní pokrytí %", () => {
    expect(
      formatPrintColorsSummaryForDisplay("P 3570 C 20.1% + P 6146 C 6.8% + K 2.4%")
    ).toBe("P 3570 C + P 6146 C + K");
  });

  it("ponechá souhrn bez %", () => {
    expect(formatPrintColorsSummaryForDisplay("CMYK + P 485 C")).toBe("CMYK + P 485 C");
  });

  it("prázdný vstup", () => {
    expect(formatPrintColorsSummaryForDisplay(null)).toBe("");
    expect(formatPrintColorsSummaryForDisplay("")).toBe("");
  });
});
