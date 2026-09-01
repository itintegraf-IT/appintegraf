import type { OrderPdfTemplate, ParsedPdfOrder, ParsedPdfOrderItem } from "./types";
import { normalizeLines, parseCzDate, parseCzNumber } from "./parse-utils";

/**
 * Parser objednávek PS Plasty (QI – OBJEDNÁVKA VO-*).
 *
 * Layout A – číslo zboží (5 číslic) na začátku řádku = yourMaterialNo:
 *   18751 ks 1 000
 *   000,00
 *   IML ZORBA, Smetanový jogurt …
 *   0,33 330 000,00 21,00 0,00 % 330 000,00
 * nebo na jednom řádku:
 *   17394 ks 27 000,00 IML Gastro servis …
 *
 * Layout B – Popis-first, Kód IG (NN-NN-NNN) v popisu, sloupec Číslo = customerMaterialNo:
 *   IML HASOFT STAVLEP - … 02-03-323 (08/26) AK2
 *   10828
 *   1 500,00 ks
 *   0,81 1 215,00 21,00 0,00 1 215,00
 */

const IG_CODE_IN_TEXT = /\b(\d{2}-\d{2}-\d{3})\b/;

const PRICE_LINE =
  /^(\d+,\d+)\s+([\d\s]+,\d+)\s+(\d+,\d+)\s+([\d\s]+(?:,\d+)?)\s*%?\s*([\d\s]+,\d+)$/;

const LAYOUT_B_ONE_LINE =
  /^(IML.+)\s+(\d{5})\s+([\d\s]+,\d+)\s*ks\s+(\d+,\d+)\s+([\d\s]+,\d+)\s+\d+,\d+\s+[\d\s]+(?:,\d+)?\s*%?\s*[\d\s]+,\d+$/i;

const QTY_LINE = /^([\d\s]+,\d+)\s*ks$/i;
const CUSTOMER_NO_LINE = /^(\d{5})$/;

function extractIgCodeFromDescription(text: string): string | null {
  const m = text.match(IG_CODE_IN_TEXT);
  return m ? m[1] : null;
}

function emptyItem(itemNo: string, description: string): ParsedPdfOrderItem {
  return {
    itemNo,
    description,
    customerMaterialNo: null,
    yourMaterialNo: itemNo,
    quantity: null,
    price: null,
    priceBasis: 1,
    netAmount: null,
    deliveryDate: null,
  };
}

function emptyItemFromDescription(
  igCode: string | null,
  customerNo: string | null,
  description: string
): ParsedPdfOrderItem {
  const code = igCode ?? "?";
  return {
    itemNo: code,
    description,
    customerMaterialNo: customerNo,
    yourMaterialNo: igCode,
    quantity: null,
    price: null,
    priceBasis: 1,
    netAmount: null,
    deliveryDate: null,
  };
}

function isLayoutBItemStart(line: string): boolean {
  return /^IML\b/i.test(line) || (IG_CODE_IN_TEXT.test(line) && !PRICE_LINE.test(line));
}

export function parsePsPlastyOrderText(text: string): ParsedPdfOrder {
  const lines = normalizeLines(text);
  const warnings: string[] = [];
  const items: ParsedPdfOrderItem[] = [];
  const noteLines: string[] = [];

  let orderNumber = "";
  let orderDate: string | null = null;
  let currency: string | null = "CZK";
  let totalAmount: number | null = null;

  for (const line of lines) {
    if (!orderNumber) {
      const m =
        line.match(/OBJEDNÁVKA\s+(VO-\d{4}-\d+)/i) ??
        line.match(/Číslo dokladu\.?:\s*(VO-\d{4}-\d+)/i);
      if (m) orderNumber = m[1];
    }
    if (!orderDate) {
      const m = line.match(/^Datum:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
      if (m) orderDate = parseCzDate(m[1]);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (!/Cena celkem bez DPH/i.test(lines[i])) continue;
    const candidates: number[] = [];
    for (let j = Math.max(0, i - 8); j < i; j++) {
      const n = parseCzNumber(lines[j].replace(/CZK/gi, "").trim());
      if (n != null && n >= 1000) candidates.push(n);
    }
    if (candidates.length >= 1) {
      if (candidates.length >= 3) {
        const [a, b, c] = candidates.slice(-3);
        if (Math.abs(a + b - c) / c < 0.02) totalAmount = a;
        else totalAmount = Math.max(...candidates);
      } else if (candidates.length === 2) {
        totalAmount = Math.max(...candidates);
      } else {
        totalAmount = candidates[0];
      }
    }
    break;
  }

  let current: ParsedPdfOrderItem | null = null;
  let qtyBuffer = "";
  let inTable = false;
  let currentLayout: "a" | "b" | null = null;
  let layoutBPhase: "desc" | "customerNo" | "qty" | "price" | "done" | null = null;

  const finalizeLayoutB = () => {
    if (!current || currentLayout !== "b") return;
    const ig =
      current.yourMaterialNo ?? extractIgCodeFromDescription(current.description);
    if (ig) {
      current.yourMaterialNo = ig;
      current.itemNo = ig;
    } else {
      warnings.push(
        `Položka ${current.description.slice(0, 40)}…: v popisu chybí Kód IG (NN-NN-NNN).`
      );
    }
  };

  const push = () => {
    if (!current) return;
    if (currentLayout === "b") {
      finalizeLayoutB();
    } else if (qtyBuffer) {
      const q = parseCzNumber(qtyBuffer);
      if (q != null) current.quantity = Math.round(q);
      qtyBuffer = "";
    }
    items.push(current);
    current = null;
    currentLayout = null;
    layoutBPhase = null;
  };

  for (const line of lines) {
    if (!line) continue;
    if (/Popis.*Číslo|Množství/i.test(line) && /Cena/i.test(line)) {
      inTable = true;
      continue;
    }
    if (/Tento doklad byl vytištěn|Celkem s DPH|Cena celkem bez DPH|Vystavil:/i.test(line)) {
      if (inTable) {
        push();
        inTable = false;
      }
      if (/Cena IML|prosím|Děkuji/i.test(line)) noteLines.push(line);
      continue;
    }
    if (/^OBJEDNÁVKA\s|Číslo dokladu|Datum:|Page |-- \d+ of/i.test(line)) continue;
    if (!inTable && !current) {
      if (/^\d{5}\s+ks\b/i.test(line)) {
        inTable = true;
      } else if (isLayoutBItemStart(line)) {
        inTable = true;
      } else {
        continue;
      }
    }

    const oneLineB = line.match(LAYOUT_B_ONE_LINE);
    if (oneLineB) {
      push();
      const desc = oneLineB[1].trim();
      const igCode = extractIgCodeFromDescription(desc);
      current = emptyItemFromDescription(igCode, oneLineB[2], desc);
      current.quantity = Math.round(parseCzNumber(oneLineB[3]) ?? 0) || null;
      current.price = parseCzNumber(oneLineB[4]);
      current.netAmount = parseCzNumber(oneLineB[5]);
      currentLayout = "b";
      layoutBPhase = "done";
      continue;
    }

    if (/^IML\b/i.test(line)) {
      if (currentLayout === "a") {
        // popis položky layout A – zpracuje se níže
      } else {
        push();
        const igCode = extractIgCodeFromDescription(line);
        current = emptyItemFromDescription(igCode, null, line.trim());
        currentLayout = "b";
        layoutBPhase = igCode ? "customerNo" : "desc";
        continue;
      }
    }

    const itemStart = line.match(/^(\d{5})\s+ks\s+(.+)$/i);
    if (itemStart) {
      push();
      const rest = itemStart[2].trim();
      const withDesc = rest.match(/^([\d\s]+(?:,\d+)?)\s+(IML\b.+)$/i);
      if (withDesc) {
        current = emptyItem(itemStart[1], withDesc[2].trim());
        current.quantity = Math.round(parseCzNumber(withDesc[1]) ?? 0) || null;
        qtyBuffer = "";
      } else {
        current = emptyItem(itemStart[1], "");
        qtyBuffer = rest;
      }
      currentLayout = "a";
      continue;
    }

    if (!current) continue;

    if (currentLayout === "b") {
      if (layoutBPhase === "desc") {
        current.description = `${current.description} ${line}`.trim();
        const igCode = extractIgCodeFromDescription(current.description);
        if (igCode) {
          current.yourMaterialNo = igCode;
          current.itemNo = igCode;
          layoutBPhase = "customerNo";
        }
        continue;
      }

      if (layoutBPhase === "customerNo") {
        const cn = line.match(CUSTOMER_NO_LINE);
        if (cn) {
          current.customerMaterialNo = cn[1];
          layoutBPhase = "qty";
          continue;
        }
        if (!PRICE_LINE.test(line) && !QTY_LINE.test(line)) {
          current.description = `${current.description} ${line}`.trim();
          const igCode = extractIgCodeFromDescription(current.description);
          if (igCode) {
            current.yourMaterialNo = igCode;
            current.itemNo = igCode;
          }
          continue;
        }
      }

      if (layoutBPhase === "qty" || (current.quantity == null && QTY_LINE.test(line))) {
        const qm = line.match(QTY_LINE);
        if (qm) {
          current.quantity = Math.round(parseCzNumber(qm[1]) ?? 0) || null;
          layoutBPhase = "price";
          continue;
        }
      }

      const priceB = line.match(PRICE_LINE);
      if (priceB) {
        current.price = parseCzNumber(priceB[1]);
        current.netAmount = parseCzNumber(priceB[2]);
        layoutBPhase = "done";
        continue;
      }

      continue;
    }

    if (current.quantity == null && /^[\d\s]+(?:,\d+)?$/.test(line) && !PRICE_LINE.test(line)) {
      qtyBuffer = `${qtyBuffer} ${line}`.trim();
      const q = parseCzNumber(qtyBuffer);
      if (q != null && q >= 100) {
        current.quantity = Math.round(q);
        qtyBuffer = "";
      }
      continue;
    }

    const price = line.match(PRICE_LINE);
    if (price) {
      if (qtyBuffer) {
        const q = parseCzNumber(qtyBuffer);
        if (q != null) current.quantity = Math.round(q);
        qtyBuffer = "";
      }
      current.price = parseCzNumber(price[1]);
      current.netAmount = parseCzNumber(price[2]);
      continue;
    }

    if (!PRICE_LINE.test(line) && !/^\d{5}\s+ks\b/i.test(line)) {
      current.description = `${current.description} ${line}`.trim();
    }
  }
  push();

  for (const line of lines) {
    if (/Cena IML|prosím poslat|Děkuji/i.test(line)) {
      if (!noteLines.includes(line)) noteLines.push(line);
    }
  }

  if (!orderNumber) warnings.push("V PDF se nepodařilo najít číslo objednávky (VO-…).");
  if (!orderDate) warnings.push("V PDF se nepodařilo najít datum objednávky.");
  if (items.length === 0) warnings.push("V PDF se nepodařilo najít žádné položky.");
  for (const it of items) {
    if (it.quantity == null) warnings.push(`Položka ${it.itemNo}: nenalezeno množství.`);
  }

  return {
    orderNumber,
    orderDate,
    currency,
    items,
    notes: noteLines.join("\n").trim(),
    totalAmount,
    warnings,
  };
}

export const psPlastyOrderPdfTemplate: OrderPdfTemplate = {
  key: "psplasty",
  label: "PS Plasty (QI OBJEDNÁVKA VO-*)",
  customerHint: "PS Plasty",
  detect: (text) =>
    /OBJEDNÁVKA\s+VO-\d{4}-\d+/i.test(text) ||
    /PS PLASTY/i.test(text) ||
    /PS EUROPLAST/i.test(text),
  parse: parsePsPlastyOrderText,
};
