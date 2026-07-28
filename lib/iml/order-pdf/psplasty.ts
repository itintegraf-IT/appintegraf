import type { OrderPdfTemplate, ParsedPdfOrder, ParsedPdfOrderItem } from "./types";
import { normalizeLines, parseCzDate, parseCzNumber } from "./parse-utils";

/**
 * Parser objednávek PS Plasty (QI – OBJEDNÁVKA VO-*).
 *
 * Extrakce z PDF je často rozházená (množství na 2 řádcích). Typický blok:
 *   18751 ks 1 000
 *   000,00
 *   IML ZORBA, Smetanový jogurt …
 *   0,33 330 000,00 21,00 0,00 % 330 000,00
 * nebo na jednom řádku:
 *   17394 ks 27 000,00 IML Gastro servis …
 *   0,33 8 910,00 21,00 0,00 % 8 910,00
 *
 * Číslo zboží (5 číslic) = Integraf ig_code → yourMaterialNo.
 */

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

const PRICE_LINE =
  /^(\d+,\d+)\s+([\d\s]+,\d+)\s+(\d+,\d+)\s+([\d\s]+(?:,\d+)?)\s*%?\s*([\d\s]+,\d+)$/;

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
    if (/Cena celkem bez DPH/i.test(line)) {
      // celková částka bývá na okolních řádcích
    }
  }

  // Cena celkem bez DPH – číslo přímo u popisku (ne DPH / celkem s DPH)
  for (let i = 0; i < lines.length; i++) {
    if (!/Cena celkem bez DPH/i.test(lines[i])) continue;
    // v QI výstupu bývají částky nad popiskem: bez DPH, DPH, s DPH
    const candidates: number[] = [];
    for (let j = Math.max(0, i - 8); j < i; j++) {
      const n = parseCzNumber(lines[j].replace(/CZK/gi, "").trim());
      if (n != null && n >= 1000) candidates.push(n);
    }
    if (candidates.length >= 1) {
      // typicky [bezDPH, DPH] nebo [bezDPH, DPH, sDPH] – ber největší z prvních dvou, pokud třetí ≈ součet
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

  const push = () => {
    if (!current) return;
    if (qtyBuffer) {
      const q = parseCzNumber(qtyBuffer);
      if (q != null) current.quantity = Math.round(q);
      qtyBuffer = "";
    }
    items.push(current);
    current = null;
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
      // položka může začít i bez hlavičky tabulky (strana 2)
      if (!/^\d{5}\s+ks\b/i.test(line)) continue;
      inTable = true;
    }

    const itemStart = line.match(/^(\d{5})\s+ks\s+(.+)$/i);
    if (itemStart) {
      push();
      const rest = itemStart[2].trim();
      // "1 000" nebo "27 000,00 IML Gastro…" nebo "1 000 000,00 IML…"
      const withDesc = rest.match(/^([\d\s]+(?:,\d+)?)\s+(IML\b.+)$/i);
      if (withDesc) {
        current = emptyItem(itemStart[1], withDesc[2].trim());
        current.quantity = Math.round(parseCzNumber(withDesc[1]) ?? 0) || null;
        qtyBuffer = "";
      } else {
        current = emptyItem(itemStart[1], "");
        qtyBuffer = rest;
      }
      continue;
    }

    if (!current) continue;

    // Continuace množství: "000,00"
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

    // Popis
    if (!PRICE_LINE.test(line) && !/^\d{5}\s+ks\b/i.test(line)) {
      current.description = `${current.description} ${line}`.trim();
    }
  }
  push();

  // Poznámka z konce dokladu
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
  detect: (text) => /OBJEDNÁVKA\s+VO-\d{4}-\d+/i.test(text) || /PS PLASTY/i.test(text),
  parse: parsePsPlastyOrderText,
};
