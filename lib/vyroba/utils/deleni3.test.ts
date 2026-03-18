import { describe, it, expect } from "vitest";
import { deleni3 } from "./deleni3";

describe("deleni3", () => {
  it("formátuje číslo s mezerami po 3 cifrách", () => {
    expect(deleni3("1234567")).toBe("1 234 567");
    expect(deleni3("1234567890")).toBe("1 234 567 890");
  });

  it("zachovává krátká čísla", () => {
    expect(deleni3("123")).toBe("123");
    expect(deleni3("12")).toBe("12");
  });

  it("odstraňuje existující mezery a přeformátuje", () => {
    expect(deleni3("1 234 567")).toBe("1 234 567");
  });
});
