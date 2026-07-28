import type { OrderPdfTemplate, ParsedPdfOrder, ParsedPdfOrderItem } from "./types";
import { normalizeLines, parseDashDate } from "./parse-utils";

/**
 * Parser SFA Packaging B.V. (PURCHASE ORDER IK*).
 *
 *   PURCHASE ORDER
 *   IK251631
 *   Order date … 20-10-2025
 *   Currency … EUR
 *   Product  SFAcode  Description  Quantity  Unit  Delivery
 *   403583  403583  IML bak 750ml Primar Bacalao  25.000  Pcs  13-11-2025
 *   Packaging: …
 *
 * Product i SFAcode = stejné číslo → ukládáme do customerMaterialNo i yourMaterialNo.
 * Množství "25.000" = 25000 (tečka = tisíce).
 */

function parseQty(raw: string): number | null {
  const cleaned = raw.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function parseSfaOrderText(text: string): ParsedPdfOrder {
  const lines = normalizeLines(text);
  const warnings: string[] = [];
  const items: ParsedPdfOrderItem[] = [];
  const noteLines: string[] = [];

  let orderNumber = "";
  let orderDate: string | null = null;
  let currency: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!orderNumber && /^PURCHASE ORDER$/i.test(line)) {
      // číslo bývá pár řádků pod hlavičkou nebo hned u Our orderno
      for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        if (/^IK\d+/i.test(lines[j])) {
          orderNumber = lines[j].match(/^(IK\d+)/i)?.[1] ?? lines[j];
          break;
        }
      }
    }
    if (!orderNumber) {
      const m = line.match(/Our orderno\.?\s*:?\s*(IK\S+)/i);
      if (m) orderNumber = m[1];
    }
    if (!orderDate) {
      // "Order date" a hodnota na sousedním řádku / stejném bloku
      if (/^Order date$/i.test(line) || /Order date/i.test(line)) {
        const same = line.match(/(\d{1,2}-\d{1,2}-\d{4})/);
        if (same) orderDate = parseDashDate(same[1]);
        else {
          for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
            if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(lines[j])) {
              orderDate = parseDashDate(lines[j]);
              break;
            }
          }
        }
      }
    }
    if (!currency) {
      if (/^Currency$/i.test(line)) {
        for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
          if (/^[A-Z]{3}$/.test(lines[j])) {
            currency = lines[j];
            break;
          }
        }
      }
      const m = line.match(/Currency\s*:?\s*([A-Z]{3})\b/i);
      if (m) currency = m[1];
    }
  }

  // Fallback čísla objednávky z textu IK…
  if (!orderNumber) {
    const m = text.match(/\b(IK\d{5,})\b/i);
    if (m) orderNumber = m[1];
  }
  // Měna: EUR/CZK/USD v hlavičce (často na vlastním řádku u Order date)
  if (!currency) {
    const m = text.match(/\b(EUR|CZK|USD|GBP)\b/);
    if (m) currency = m[1];
  }
  // Datum: po IK čísle bývá supplier no + order date (ne delivery z položek)
  if (!orderDate) {
    const ikIdx = lines.findIndex((l) => /^IK\d+/i.test(l));
    if (ikIdx >= 0) {
      for (let j = ikIdx + 1; j < Math.min(ikIdx + 6, lines.length); j++) {
        if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(lines[j])) {
          orderDate = parseDashDate(lines[j]);
          break;
        }
      }
    }
  }
  if (!orderDate) {
    const m = text.match(/Order date[^\d]{0,40}(\d{1,2}-\d{1,2}-\d{4})/i);
    if (m) orderDate = parseDashDate(m[1]);
  }

  const itemRe =
    /^(\d{5,8})\s+(\d{5,8})\s+(.+?)\s+([\d.]+)\s+Pcs\s+(\d{1,2}-\d{1,2}-\d{4})$/i;

  for (const line of lines) {
    const m = line.match(itemRe);
    if (m) {
      items.push({
        itemNo: String(items.length + 1).padStart(5, "0"),
        description: m[3].trim(),
        customerMaterialNo: m[2],
        yourMaterialNo: m[1],
        quantity: parseQty(m[4]),
        price: null,
        priceBasis: 1,
        netAmount: null,
        deliveryDate: parseDashDate(m[5]),
      });
      continue;
    }
    if (/^Packaging:/i.test(line)) {
      noteLines.push(line);
    }
  }

  if (!orderNumber) warnings.push("V PDF se nepodařilo najít číslo objednávky (IK…).");
  if (!orderDate) warnings.push("V PDF se nepodařilo najít datum objednávky.");
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

export const sfaOrderPdfTemplate: OrderPdfTemplate = {
  key: "sfa",
  label: "SFA Packaging (PURCHASE ORDER IK*)",
  customerHint: "SFA",
  detect: (text) =>
    /SFA Packaging/i.test(text) || (/PURCHASE ORDER/i.test(text) && /\bIK\d{5,}\b/.test(text)),
  parse: parseSfaOrderText,
};
