import { describe, expect, it } from "vitest";
import { parseImpositionBody } from "@/lib/iml/shape-tool-parse";

describe("parseImpositionBody", () => {
  it("přijme cut-only bez tool_id a sečte užitky", () => {
    const parsed = parseImpositionBody({
      imposition_code: "MT097+078",
      is_cut_only: true,
      layout_type: "SET",
      shapes: [
        { shape_id: 1, positions_on_sheet: 24, is_primary: true },
        { shape_id: 2, positions_on_sheet: 24 },
      ],
    });
    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.tool_id).toBeNull();
    expect(parsed.positions_count).toBe(48);
    expect(parsed.shapes).toHaveLength(2);
    expect(parsed.is_cut_only).toBe(true);
  });

  it("odmítne SOLO s více tvary", () => {
    const parsed = parseImpositionBody({
      tool_id: 5,
      imposition_code: "Montáž A23A",
      layout_type: "SOLO",
      shapes: [
        { shape_id: 1, positions_on_sheet: 10 },
        { shape_id: 2, positions_on_sheet: 10 },
      ],
    });
    expect(parsed).toEqual({
      error: "SOLO montáž může mít nejvýše jeden tvar v užitcích.",
    });
  });
});
