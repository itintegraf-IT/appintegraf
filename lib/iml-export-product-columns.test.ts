import { describe, expect, it } from "vitest";
import {
  emptyProductExportSourceRow,
  serializeProductFieldValue,
} from "@/lib/iml-export-product-field-catalog";
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

  it("serializes print data and custom fields", () => {
    const row = {
      ...emptyProductExportSourceRow(1),
      print_data_version: "v3",
      stock_quantity: 42,
      last_edited_by: "Admin",
      custom_data: { foo: "bar" },
      foil_material: { name: "PP fólie" },
      iml_product_colors: [
        { coverage_pct: 75, iml_pantone_colors: { code: "186 C" } },
      ],
    } as ProductExportSourceRow;

    expect(serializeProductFieldValue(row, "print_data_version")).toBe("v3");
    expect(serializeProductFieldValue(row, "stock_quantity")).toBe("42");
    expect(serializeProductFieldValue(row, "last_edited_by")).toBe("Admin");
    expect(serializeProductFieldValue(row, "custom_data")).toBe('{"foo":"bar"}');
    expect(serializeProductFieldValue(row, "foil_material_name")).toBe("PP fólie");
    expect(serializeProductFieldValue(row, "pantone_coverage")).toBe("186 C:75%");
  });
});
