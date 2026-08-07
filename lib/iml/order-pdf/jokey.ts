import type { OrderPdfTemplate, ParsedPdfOrder, ParsedPdfOrderItem } from "./types";
import { normalizeLines, parseCzDate } from "./parse-utils";

/**
 * Parser Jokey Request (Request Nr. AN*).
 *
 *   Request Nr. AN121853 / 499542
 *   22.10.2025
 *   AbgabeTermin 24.10.2025
 *   EUR  CZ  JET 56P crystal 100  1 879170 22.000 pcs
 *   material: …
 *   …
 *   Customer FOOD
 *
 * Item (879170) = Jokey article → customerMaterialNo / client_code.
 * Quantity "22.000" = 22000 (tečka = tisíce).
 */

function parseQty(raw: string): number | null {
  const cleaned = raw.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const ITEM_LINE =
  /^(EUR|CZK|USD)\s+([A-Z]{2})\s+(.+?)\s+(\d+)\s+(\d{5,8})\s+([\d.]+)\s+pcs$/i;

export function parseJokeyOrderText(text: string): ParsedPdfOrder {
  const lines = normalizeLines(text);
  const warnings: string[] = [];
  const items: ParsedPdfOrderItem[] = [];
  const noteLines: string[] = [];

  let orderNumber = "";
  let orderDate: string | null = null;
  let deliveryDate: string | null = null;
  let currency: string | null = "EUR";

  for (const line of lines) {
    if (!orderNumber) {
      const m = line.match(/Request Nr\.?\s*(AN\d+)/i);
      if (m) orderNumber = m[1];
    }
    if (!deliveryDate) {
      const m = line.match(/AbgabeTermin\s+(\d{1,2}\.\d{1,2}\.\d{4})/i);
      if (m) deliveryDate = parseCzDate(m[1]);
    }
    if (!orderDate) {
      // Datum u Request Nr. řádku: "22.10.2025 Request Nr. AN…"
      const m = line.match(/^(\d{1,2}\.\d{1,2}\.\d{4})\s+Request Nr/i);
      if (m) orderDate = parseCzDate(m[1]);
      const m2 = line.match(/Request Nr\.[^\d]*\d+[^\d]+(\d{1,2}\.\d{1,2}\.\d{4})/i);
      if (!orderDate && m2) orderDate = parseCzDate(m2[1]);
    }
  }

  // Datum requestu často na stejném řádku před/za Request Nr.
  if (!orderDate) {
    const m = text.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*Request Nr/i)
      ?? text.match(/Request Nr\.[^\n]*?(\d{1,2}\.\d{1,2}\.\d{4})/i);
    if (m) orderDate = parseCzDate(m[1]);
  }

  let lastItem: ParsedPdfOrderItem | null = null;

  for (const line of lines) {
    if (/^Page \d+|Jokey Praha|Zapsána v|Deutsche Bank|Kind Regards|Terms$|payment terms:/i.test(line)) {
      continue;
    }
    if (/^Attention:/i.test(line) || /^Terms of delivery:/i.test(line)) {
      noteLines.push(line);
      continue;
    }

    const m = line.match(ITEM_LINE);
    if (m) {
      lastItem = {
        itemNo: m[4].padStart(5, "0"),
        description: m[3].trim(),
        customerMaterialNo: m[5],
        yourMaterialNo: null,
        quantity: parseQty(m[6]),
        price: null,
        priceBasis: 1,
        netAmount: null,
        deliveryDate,
      };
      items.push(lastItem);
      currency = m[1].toUpperCase();
      continue;
    }

    // Specifikace (barvy, materiál…) – jen do poznámek objednávky u první položky / souhrnně
    if (
      lastItem &&
      /^(material|Varnish|Colours|Others|Packaging|Specific film|Customer)\b/i.test(line)
    ) {
      // necháváme popis čistý; detaily uživateľ uvidí v PDF
      continue;
    }
  }

  if (!orderNumber) warnings.push("V PDF se nepodařilo najít číslo requestu (AN…).");
  if (!orderDate) warnings.push("V PDF se nepodařilo najít datum requestu.");
  if (items.length === 0) warnings.push("V PDF se nepodařilo najít žádné položky.");

  return {
    orderNumber,
    orderDate,
    currency,
    items,
    notes: noteLines.join("\n").trim(),
    totalAmount: null,
    warnings,
  };
}

export const jokeyOrderPdfTemplate: OrderPdfTemplate = {
  key: "jokey",
  label: "Jokey (Request Nr. AN*)",
  customerHint: "Jokey",
  detect: (text) => /Request Nr\.?\s*AN\d+/i.test(text) || /Jokey Praha/i.test(text),
  parse: parseJokeyOrderText,
};
