import { describe, expect, it } from "vitest";
import {
  sanitizeProductExportColumns,
  sanitizeProductExportFilters,
  buildProductExportXml,
  type ProductExportSourceRow,
} from "@/lib/iml-export-product-columns";

describe("iml-export-product-columns", () => {
  it("sanitizes unknown keys away", () => {
    const cols = sanitizeProductExportColumns([
      { key: "ig_code" },
      { key: "DROP TABLE" },
      "sku",
    ]);
    expect(cols.map((c) => c.key)).toEqual(["ig_code", "sku"]);
  });

  it("sanitizes asset flags in filters", () => {
    expect(
      sanitizeProductExportFilters({
        include_print: "true",
        include_softproof: 1,
      })
    ).toEqual({ include_print: true, include_softproof: true });

    expect(
      sanitizeProductExportFilters({
        include_print: false,
        include_softproof: null,
      })
    ).toEqual({});
  });

  it("builds simple XML", () => {
    const row = {
      id: 1,
      ig_code: "A&B",
      ig_short_name: null,
      client_code: null,
      client_name: null,
      sku: null,
      product_kind: "iml",
      requester: null,
      label_shape_code: null,
      product_format: null,
      format_width_mm: null,
      format_height_mm: null,
      die_cut_tool_code: null,
      assembly_code: null,
      positions_on_sheet: null,
      labels_per_sheet: null,
      pieces_per_box: null,
      pieces_per_pallet: null,
      foil_type: null,
      color_coverage: null,
      ean_code: null,
      item_status: "aktivní",
      approval_status: null,
      approval_date: null,
      color_count: null,
      print_colors_text: null,
      label_type: null,
      has_print_sample: false,
      has_print_proof: false,
      is_active: true,
      archived_at: null,
      created_at: new Date("2026-01-01"),
      updated_at: new Date("2026-01-02"),
    } as ProductExportSourceRow;

    const xml = buildProductExportXml(row ? [row] : [], [
      { key: "id" },
      { key: "ig_code" },
    ]);
    expect(xml).toContain("<ig_code>A&amp;B</ig_code>");
    expect(xml).toContain("<id>1</id>");
  });
});
