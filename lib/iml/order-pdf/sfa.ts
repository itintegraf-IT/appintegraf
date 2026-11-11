import type { OrderPdfTemplate, ParsedPdfOrder, ParsedPdfOrderItem } from "./types";
import { normalizeLines, parseDashDate } from "./parse-utils";

/**
 * Parser SFA Packaging (PURCHASE ORDER IK* / ODA*).
 *
 * NL (B.V.):
 *   PURCHASE ORDER
 *   IK251631
 *   Product  SFAcode  Description  Quantity  Unit  Delivery
 *   403583  403583  IML bak 750ml …  25.000  Pcs  13-11-2025
 *
 * IT (Italia):
 *   PURCHASE ORDER
 *   ODA26258
 *   403434  IML cup 400ml …  125.000  Pcs  30-11-2026
 *   (jeden sloupec kódu = Product = SFAcode)
 *
 * NL multiline (IG + SFAcode, qty na dalším řádku):
 *   07-03-003 etiketa  403113  IML Cup 480ml …
 *   500G
 *   5.000  Pcs  09-11-2026
 *
 * Množství "25.000" = 25000 (tečka = tisíce).
 */

const ORDER_NO_LINE = /^(IK|ODA)\d+/i;
const ORDER_NO_CAPTURE = /^((?:IK|ODA)\d+)/i;
const ORDER_NO_FALLBACK = /\b((?:IK|ODA)\d{5,})\b/i;
const OUR_ORDERNO = /Our orderno\.?\s*:?\s*((?:IK|ODA)\S+)/i;

/** Product = IG + typ (etiketa/dno…), SFAcode, začátek popisu. */
const ITEM_START_IG =
  /^(\d{2}-\d{2}-\d{3})\s+\S+\s+(\d{5,8})\s+(.+)$/i;
const QTY_DELIVERY_LINE =
  /^([\d.]+)\s+Pcs\s+(\d{1,2}-\d{1,2}-\d{4})$/i;

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
      // číslo bývá pár řádků pod hlavičkou (IK… / ODA…)
      for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        if (ORDER_NO_LINE.test(lines[j])) {
          orderNumber = lines[j].match(ORDER_NO_CAPTURE)?.[1] ?? lines[j];
          break;
        }
      }
    }
    if (!orderNumber) {
      const m = line.match(OUR_ORDERNO);
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

  // Fallback čísla objednávky z textu IK… / ODA…
  if (!orderNumber) {
    const m = text.match(ORDER_NO_FALLBACK);
    if (m) orderNumber = m[1];
  }
  // Měna: EUR/CZK/USD v hlavičce (často na vlastním řádku u Order date)
  if (!currency) {
    const m = text.match(/\b(EUR|CZK|USD|GBP)\b/);
    if (m) currency = m[1];
  }
  // Datum: po IK/ODA čísle bývá supplier no + order date (ne delivery z položek)
  if (!orderDate) {
    const orderIdx = lines.findIndex((l) => ORDER_NO_LINE.test(l));
    if (orderIdx >= 0) {
      for (let j = orderIdx + 1; j < Math.min(orderIdx + 6, lines.length); j++) {
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

  // NL: Product + SFAcode (dvě čísla). IT: jeden kód.
  const itemReDual =
    /^(\d{5,8})\s+(\d{5,8})\s+(.+?)\s+([\d.]+)\s+Pcs\s+(\d{1,2}-\d{1,2}-\d{4})$/i;
  const itemReSingle =
    /^(\d{5,8})\s+(.+?)\s+([\d.]+)\s+Pcs\s+(\d{1,2}-\d{1,2}-\d{4})$/i;

  let pending: {
    yourMaterialNo: string;
    customerMaterialNo: string;
    description: string;
  } | null = null;

  const pushPending = (quantity: number | null, deliveryDate: string | null) => {
    if (!pending) return;
    items.push({
      itemNo: String(items.length + 1).padStart(5, "0"),
      description: pending.description.trim(),
      customerMaterialNo: pending.customerMaterialNo,
      yourMaterialNo: pending.yourMaterialNo,
      quantity,
      price: null,
      priceBasis: 1,
      netAmount: null,
      deliveryDate,
    });
    pending = null;
  };

  for (const line of lines) {
    if (!line) continue;

    const dual = line.match(itemReDual);
    if (dual) {
      pushPending(null, null);
      items.push({
        itemNo: String(items.length + 1).padStart(5, "0"),
        description: dual[3].trim(),
        customerMaterialNo: dual[2],
        yourMaterialNo: dual[1],
        quantity: parseQty(dual[4]),
        price: null,
        priceBasis: 1,
        netAmount: null,
        deliveryDate: parseDashDate(dual[5]),
      });
      continue;
    }
    const single = line.match(itemReSingle);
    if (single) {
      pushPending(null, null);
      const code = single[1];
      items.push({
        itemNo: String(items.length + 1).padStart(5, "0"),
        description: single[2].trim(),
        customerMaterialNo: code,
        yourMaterialNo: code,
        quantity: parseQty(single[3]),
        price: null,
        priceBasis: 1,
        netAmount: null,
        deliveryDate: parseDashDate(single[4]),
      });
      continue;
    }

    const igStart = line.match(ITEM_START_IG);
    if (igStart) {
      pushPending(null, null);
      pending = {
        yourMaterialNo: igStart[1],
        customerMaterialNo: igStart[2],
        description: igStart[3].trim(),
      };
      continue;
    }

    const qtyLine = line.match(QTY_DELIVERY_LINE);
    if (qtyLine && pending) {
      pushPending(parseQty(qtyLine[1]), parseDashDate(qtyLine[2]));
      continue;
    }

    if (pending) {
      if (/^Packaging:/i.test(line) || /^Page\s*:/i.test(line) || /^--\s*\d+\s+of/i.test(line)) {
        pushPending(null, null);
        if (/^Packaging:/i.test(line)) noteLines.push(line);
        continue;
      }
      pending.description = `${pending.description} ${line}`.trim();
      continue;
    }

    if (/^Packaging:/i.test(line)) {
      noteLines.push(line);
    }
  }
  pushPending(null, null);

  if (!orderNumber) warnings.push("V PDF se nepodařilo najít číslo objednávky (IK…/ODA…).");
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
  label: "SFA Packaging (PURCHASE ORDER IK* / ODA*)",
  customerHint: "SFA",
  detect: (text) =>
    /SFA Packaging/i.test(text) ||
    (/PURCHASE ORDER/i.test(text) && /\b(?:IK|ODA)\d{5,}\b/i.test(text)),
  parse: parseSfaOrderText,
};
