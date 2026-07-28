import type { OrderPdfTemplate, ParsedPdfOrder, ParsedPdfOrderItem } from "./types";

/**
 * Parser SAP objednávek Orkla Foods (Purchase Order).
 *
 * Struktura textu (po extrakci z PDF, řádek po řádku):
 *   Purchase Order 4500210202
 *   Order date:  25.03.2026
 *   ... tabulková hlavička končící řádky "Delivery" / "date" ...
 *   00010  Bot Lab Wok Omáčka Med A Zázv Nd     ← item no + začátek popisu
 *   219011617                                    ← Material No zákazníka
 *   10.000  PCS  415,00                          ← množství + cena
 *   Per 1000 PCS                                 ← základ ceny
 *   4.150,00  15.04.2026                         ← Net Amount + datum dodání
 *   Your Material No: 320122                     ← volitelně (i obráceně "320122 Your Material No:")
 *   ... volné poznámky ...
 *   Total Amount  10.375,00
 */

/** České číslo: tečka = tisíce, čárka = desetinná ("4.150,00" → 4150). */
function parseCzechNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/\./g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** "25.03.2026" → "2026-03-25". */
function parseCzechDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

type ItemDraft = ParsedPdfOrderItem;

function emptyItem(itemNo: string, description: string): ItemDraft {
  return {
    itemNo,
    description,
    customerMaterialNo: null,
    yourMaterialNo: null,
    quantity: null,
    price: null,
    priceBasis: 1000,
    netAmount: null,
    deliveryDate: null,
  };
}

export function parseOrklaOrderText(text: string): ParsedPdfOrder {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\t/g, " ").replace(/\s+/g, " ").trim());

  let orderNumber = "";
  let orderDate: string | null = null;
  let currency: string | null = null;
  let totalAmount: number | null = null;

  for (const line of lines) {
    if (!orderNumber) {
      const m = line.match(/^Purchase Order\s+(\S+)/i);
      if (m) orderNumber = m[1];
    }
    if (!orderDate) {
      const m = line.match(/Order date:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
      if (m) orderDate = parseCzechDate(m[1]);
    }
    if (!currency) {
      const m = line.match(/Currency:\s*([A-Z]{3})\b/);
      if (m) currency = m[1];
    }
    if (totalAmount == null && /total amount/i.test(line)) {
      const m = line.replace(/total amount/i, "").match(/([\d.,]+)/);
      if (m) totalAmount = parseCzechNumber(m[1]);
    }
  }

  const items: ParsedPdfOrderItem[] = [];
  const noteLines: string[] = [];
  const warnings: string[] = [];

  let mode: "preamble" | "table" = "preamble";
  let previousLine = "";
  let current: ItemDraft | null = null;
  let done = false;

  const pushCurrent = () => {
    if (current) {
      items.push(current);
      current = null;
    }
  };

  for (const line of lines) {
    if (!line) continue;

    if (/^Page \d+\s*\/\s*\d+$/i.test(line)) {
      // Nová stránka: hlavička s adresami se přeskočí do další tabulkové hlavičky.
      mode = "preamble";
      previousLine = line;
      continue;
    }
    if (/^-+\s*\d+ of \d+\s*-+$/i.test(line)) {
      previousLine = line;
      continue;
    }

    if (mode === "preamble") {
      if (/^date$/i.test(line) && /^delivery$/i.test(previousLine)) {
        mode = "table";
      }
      previousLine = line;
      continue;
    }
    previousLine = line;

    if (done) continue;

    if (/total amount/i.test(line)) {
      done = true;
      continue;
    }
    if (/^best regards/i.test(line)) {
      done = true;
      continue;
    }

    const itemStart = line.match(/^(\d{5})\s+(.+)$/);
    if (itemStart) {
      pushCurrent();
      current = emptyItem(itemStart[1], itemStart[2]);
      continue;
    }

    if (current) {
      const yourMat =
        line.match(/^Your Material No:?\s*(\S+)$/i) ??
        line.match(/^(\S+)\s+Your Material No:?$/i);
      if (yourMat) {
        current.yourMaterialNo = yourMat[1];
        continue;
      }

      if (current.quantity == null) {
        const qty = line.match(/^([\d.,]+)\s+[A-Za-z]{2,5}\s+([\d.,]+)$/);
        if (qty) {
          const q = parseCzechNumber(qty[1]);
          current.quantity = q != null ? Math.round(q) : null;
          current.price = parseCzechNumber(qty[2]);
          continue;
        }
        if (/^\d{6,12}$/.test(line) && current.customerMaterialNo == null) {
          current.customerMaterialNo = line;
          continue;
        }
        if (current.customerMaterialNo == null) {
          // Pokračování popisu na dalším řádku.
          current.description = `${current.description} ${line}`.trim();
          continue;
        }
      } else {
        const basis = line.match(/^Per\s+([\d.,]+)\s+[A-Za-z]{2,5}$/i);
        if (basis) {
          const b = parseCzechNumber(basis[1]);
          if (b != null && b > 0) current.priceBasis = Math.round(b);
          continue;
        }
        if (current.netAmount == null) {
          const net = line.match(/^([\d.,]+)\s+(\d{1,2}\.\d{1,2}\.\d{4})$/);
          if (net) {
            current.netAmount = parseCzechNumber(net[1]);
            current.deliveryDate = parseCzechDate(net[2]);
            continue;
          }
        }
      }
    }

    noteLines.push(line);
  }
  pushCurrent();

  if (!orderNumber) warnings.push("V PDF se nepodařilo najít číslo objednávky (Purchase Order).");
  if (!orderDate) warnings.push("V PDF se nepodařilo najít datum objednávky (Order date).");
  if (items.length === 0) warnings.push("V PDF se nepodařilo najít žádné položky.");
  for (const it of items) {
    if (it.quantity == null) warnings.push(`Položka ${it.itemNo}: nenalezeno množství.`);
    if (!it.customerMaterialNo && !it.yourMaterialNo) {
      warnings.push(`Položka ${it.itemNo}: nenalezeno číslo materiálu.`);
    }
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

export const orklaOrderPdfTemplate: OrderPdfTemplate = {
  key: "orkla",
  label: "Orkla Foods (SAP Purchase Order)",
  customerHint: "Orkla",
  parse: parseOrklaOrderText,
};
