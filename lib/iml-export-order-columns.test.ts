import { describe, expect, it } from "vitest";
import {
  buildOrderLineExportCsv,
  buildOrderLineExportXml,
  sanitizeOrderExportColumns,
  sanitizeOrderExportFilters,
  type OrderLineExportSourceRow,
} from "@/lib/iml-export-order-columns";

const sampleRow = (overrides: Partial<OrderLineExportSourceRow> = {}): OrderLineExportSourceRow => ({
  order_id: 1,
  order_number: "O-1",
  job_number: "J-1",
  customer_name: "Firma",
  order_date: new Date("2026-08-01T10:00:00Z"),
  expected_ship_date: null,
  status: "nová",
  total: "100.00",
  notes: null,
  shipping_snapshot_label: null,
  shipping_snapshot_recipient: null,
  shipping_snapshot_street: null,
  shipping_snapshot_city: null,
  shipping_snapshot_postal_code: null,
  shipping_snapshot_country: null,
  order_created_at: new Date("2026-08-01T09:00:00Z"),
  line_id: 10,
  quantity: 500,
  unit_price: "1.50",
  subtotal: "750.00",
  product_id: 5,
  ig_code: "IG001",
  ig_short_name: "Etiketa",
  client_code: "C1",
  client_name: "Název",
  sku: null,
  product_kind: "iml",
  label_shape_code: null,
  product_format: null,
  format_width_mm: null,
  format_height_mm: null,
  die_cut_tool_code: null,
  foil_type: null,
  ean_code: null,
  item_status: "aktivní",
  print_colors_text: null,
  color_count: 2,
  pantone_codes: "Pantone 186 C",
  ...overrides,
});

describe("iml-export-order-columns", () => {
  it("sanitizes columns and filters", () => {
    const cols = sanitizeOrderExportColumns([{ key: "order_number" }, { key: "bogus" }, "quantity"]);
    expect(cols.map((c) => c.key)).toEqual(["order_number", "quantity"]);

    const f = sanitizeOrderExportFilters({
      status: "nová",
      order_ids: [1, "2", "x"],
      date_from: "2026-01-01",
    });
    expect(f.status).toBe("nová");
    expect(f.order_ids).toEqual([1, 2]);
    expect(f.date_from).toBe("2026-01-01");
  });

  it("builds CSV with one row per line", () => {
    const cols = sanitizeOrderExportColumns(["order_number", "quantity", "ig_code"]);
    const csv = buildOrderLineExportCsv([sampleRow()], cols);
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("O-1;500;IG001");
  });

  it("builds nested XML Orders/Items", () => {
    const cols = sanitizeOrderExportColumns([
      "order_number",
      "status",
      "quantity",
      "ig_code",
    ]);
    const xml = buildOrderLineExportXml(
      [
        sampleRow({ line_id: 1, quantity: 10 }),
        sampleRow({ line_id: 2, quantity: 20, ig_code: "IG002" }),
      ],
      cols
    );
    expect(xml).toContain("<Orders>");
    expect(xml).toContain("<Order>");
    expect(xml).toContain("<Items>");
    expect(xml.match(/<Item>/g)?.length).toBe(2);
    expect(xml).toContain("<order_number>O-1</order_number>");
    expect(xml).toContain("<ig_code>IG002</ig_code>");
  });
});
