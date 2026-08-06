import { describe, expect, it } from "vitest";
import { getGridSpec } from "@/lib/stitky/label-layout";

describe("getGridSpec", () => {
  it("vrátí výchozí spec bez override", () => {
    const spec = getGridSpec("standard");
    expect(spec.pageMarginMm).toBe(10);
    expect(spec.colGapMm).toBe(4);
  });

  it("sloučí override z nastavení", () => {
    const spec = getGridSpec("standard", { standard: { pageMarginMm: 12, colGapMm: 6 } });
    expect(spec.pageMarginMm).toBe(12);
    expect(spec.colGapMm).toBe(6);
    expect(spec.rowGapMm).toBe(1);
  });
});
