/** Konstanty a validace pro variabilní export objednávek (bez Prisma – použitelné v klientovi). */

export const ORDER_EXPORT_FIELDS = [
  "id",
  "order_number",
  "customer_name",
  "order_date",
  "expected_ship_date",
  "status",
  "total",
  "notes",
  "items_count",
  "items_summary",
  "items_detail",
  "pantone_codes",
  "created_at",
  "updated_at",
] as const;

export type OrderExportField = (typeof ORDER_EXPORT_FIELDS)[number];

const FIELD_SET = new Set<string>(ORDER_EXPORT_FIELDS);

export const ORDER_EXPORT_FIELD_LABELS: Record<OrderExportField, string> = {
  id: "ID",
  order_number: "Číslo objednávky",
  customer_name: "Zákazník",
  order_date: "Datum přijetí",
  expected_ship_date: "Plánovaná expedice",
  status: "Stav",
  total: "Celkem (Kč)",
  notes: "Poznámky",
  items_count: "Počet řádků",
  items_summary: "Položky (shrnutí)",
  items_detail: "Položky (detail)",
  pantone_codes: "Pantone",
  created_at: "Vytvořeno",
  updated_at: "Upraveno",
};

export function normalizeOrderExportFields(raw: unknown): OrderExportField[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "Pole „fields“ musí být neprázdné pole řetězců." };
  }
  const out: OrderExportField[] = [];
  for (const x of raw) {
    if (typeof x !== "string" || !FIELD_SET.has(x)) {
      return { error: `Neplatné pole exportu: ${String(x)}` };
    }
    const f = x as OrderExportField;
    if (!out.includes(f)) out.push(f);
  }
  return out;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function ordersToFlatXml(
  rows: Record<OrderExportField, string>[],
  fields: OrderExportField[]
): string {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', "<orders>"];
  for (const row of rows) {
    lines.push("  <order>");
    for (const f of fields) {
      const v = row[f] ?? "";
      lines.push(`    <${f}>${escapeXml(v)}</${f}>`);
    }
    lines.push("  </order>");
  }
  lines.push("</orders>");
  return lines.join("\n");
}

export function pickOrderExportRow(
  full: Record<OrderExportField, string>,
  fields: OrderExportField[]
): Record<string, string> {
  const o: Record<string, string> = {};
  for (const f of fields) {
    o[f] = full[f] ?? "";
  }
  return o;
}
