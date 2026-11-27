import { describe, expect, it } from "vitest";
import { parseTechnologieProducts, primaryProductFields } from "./products";

describe("parseTechnologieProducts", () => {
  it("parsuje products[] a přeskočí prázdné názvy", () => {
    const r = parseTechnologieProducts({
      products: [
        { name: "A", format_text: "1x1", note: "2x" },
        { name: "  ", format_text: "x" },
        { name: "B", format_text: "", note: "" },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.products).toHaveLength(2);
    expect(r.products[0]).toMatchObject({ name: "A", format_text: "1x1", note: "2x", sort_order: 0 });
    expect(r.products[1]).toMatchObject({ name: "B", format_text: null, note: null, sort_order: 1 });
  });

  it("legacy name na kořeni", () => {
    const r = parseTechnologieProducts({
      name: "Solo",
      format_text: "10x10",
      note: "1x",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.products).toEqual([
      { name: "Solo", format_text: "10x10", note: "1x", sort_order: 0 },
    ]);
  });

  it("chyba bez názvu", () => {
    expect(parseTechnologieProducts({ products: [{ name: "" }] }).ok).toBe(false);
    expect(parseTechnologieProducts({}).ok).toBe(false);
  });
});

describe("primaryProductFields", () => {
  it("bere první produkt", () => {
    expect(
      primaryProductFields([
        { name: "A", format_text: "1", note: null },
        { name: "B", format_text: null, note: "x" },
      ])
    ).toEqual({ name: "A", format_text: "1", note: null });
  });
});
