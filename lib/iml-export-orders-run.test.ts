import { describe, expect, it } from "vitest";
import { emptyProductExportSourceRow } from "@/lib/iml-export-product-field-catalog";
import {
  buildOrderExportBasename,
  renderOrderLineExport,
} from "@/lib/iml-export-orders-run";
import {
  sanitizeOrderExportColumns,
  type OrderLineExportSourceRow,
} from "@/lib/iml-export-order-columns";

const sampleRow = (overrides: Partial<OrderLineExportSourceRow> = {}): OrderLineExportSourceRow => ({
  order_id: 1,
  order_number: "O-1",
  job_number: null,
  customer_name: "Firma",
  order_date: new Date("2026-08-01"),
  expected_ship_date: null,
  status: "nová",
  total: "100",
  notes: null,
  shipping_snapshot_label: null,
  shipping_snapshot_recipient: null,
  shipping_snapshot_street: null,
  shipping_snapshot_city: null,
  shipping_snapshot_postal_code: null,
  shipping_snapshot_country: null,
  order_created_at: new Date("2026-08-01"),
  line_id: 10,
  quantity: 500,
  unit_price: "1.5",
  subtotal: "750",
  product_id: 5,
  product_data: {
    ...emptyProductExportSourceRow(5),
    ig_code: "02-03-323",
    ig_short_name: "Etiketa",
    product_kind: "iml",
    item_status: "aktivní",
  },
  ...overrides,
});

describe("buildOrderExportBasename", () => {
  it("jedna objednávka: zákazník_číslo_zakázky", () => {
    expect(
      buildOrderExportBasename([
        sampleRow({ customer_name: "ACME s.r.o.", job_number: "IK261735" }),
      ])
    ).toBe("ACME s.r.o._IK261735");
  });

  it("více objednávek: datovaný fallback", () => {
    const stamp = new Date().toISOString().slice(0, 10);
    expect(
      buildOrderExportBasename([
        sampleRow({ order_id: 1, customer_name: "A", job_number: "J1" }),
        sampleRow({ order_id: 2, customer_name: "B", job_number: "J2" }),
      ])
    ).toBe(`iml-objednavky-${stamp}`);
  });
});

describe("renderOrderLineExport", () => {
  it("bez assetů vrátí CSV", () => {
    const cols = sanitizeOrderExportColumns(["order_number", "quantity"]);
    const result = renderOrderLineExport("csv", [sampleRow()], cols);
    expect(result.contentType).toContain("csv");
    expect(result.body).toContain("O-1;500");
  });

  it("název souboru z zákazníka a čísla zakázky", () => {
    const cols = sanitizeOrderExportColumns(["order_number", "quantity"]);
    const result = renderOrderLineExport(
      "csv",
      [sampleRow({ customer_name: "ACME s.r.o.", job_number: "IK261735" })],
      cols
    );
    expect(result.filename).toBe("ACME s.r.o._IK261735.csv");
  });

  it("s assety doplní sloupce soubor_*", () => {
    const cols = sanitizeOrderExportColumns(["order_number", "ig_code"]);
    const paths = new Map([
      [5, { soubor_tisk: "soubory/02-03-323-tisk.pdf" }],
    ]);
    const result = renderOrderLineExport(
      "csv",
      [sampleRow()],
      cols,
      { includePrint: true, includeSoftproof: false },
      paths
    );
    expect(result.body).toContain("soubor_tisk");
    expect(result.body).toContain("soubory/02-03-323-tisk.pdf");
  });
});
