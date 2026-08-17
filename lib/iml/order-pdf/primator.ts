import type { OrderPdfTemplate, ParsedPdfOrder, ParsedPdfOrderItem } from "./types";
import { normalizeLines, parseCzDate, parseCzNumber } from "./parse-utils";

/**
 * Parser objednávek PRIMÁTOR a.s. (Objednávka zboží).
 *
 * Extrahovaná struktura (pdf-parse často přehází sloupce):
 *   PRIMÁTOR a.s.
 *   Datum: 12.08.2026 06:37
 *   9000508
 *   Objednávka zboží číslo:
 *   Název zboží / Číslo zboží / Množství / MJ / …
 *   Etiketa IPA přední M69401 tks 0,0000 0,00 300,
 *   …
 *   1 010,
 *
 * MJ „tks“ = tisíc kusů → quantity se převádí na ks (* 1000).
 * Číslo zboží (M69401) → customerMaterialNo / client_code.
 */

/** Položka: popis + kód M… + tks + jednotk.cena + cena + množství (často s koncovou čárkou). */
const ITEM_RE =
  /^(.+?)\s+(M\d+)\s+tks\s+([\d,]+)\s+([\d\s]+,\d+)\s+([\d\s]+),?\s*$/i;

export function parsePrimatorOrderText(text: string): ParsedPdfOrder {
  const lines = normalizeLines(text);
  const warnings: string[] = [];
  const items: ParsedPdfOrderItem[] = [];
  const noteLines: string[] = [];

  let orderNumber = "";
  let orderDate: string | null = null;
  let currency: string | null = "CZK";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!orderDate) {
      const m = line.match(
        /Datum(?:\s+vystavení(?:\s*\/\s*realizace)?)?:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i
      );
      if (m) orderDate = parseCzDate(m[1]);
    }

    if (!orderNumber) {
      // Číslo bývá samostatný řádek těsně před/za „Objednávka zboží číslo“
      if (/Objednávka\s+zboží\s+číslo/i.test(line)) {
        for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
          const prev = lines[j];
          if (/^\d{5,10}$/.test(prev)) {
            orderNumber = prev;
            break;
          }
        }
      }
      if (!orderNumber && /^\d{5,10}$/.test(line)) {
        const nearby = lines.slice(Math.max(0, i - 2), i + 4).join("\n");
        if (
          /Objednávka\s+zboží|Název\s+zboží|Číslo\s+zboží/i.test(nearby) &&
          !/IČO|47468661|47451980|903473/i.test(line)
        ) {
          orderNumber = line;
        }
      }
    }

    if (/Měna:\s*([A-Z]{3})/i.test(line)) {
      const m = line.match(/Měna:\s*([A-Z]{3})/i);
      if (m) currency = m[1];
    }

    if (/Vystavil|@primator\.cz|Schválil|Vyřizuje/i.test(line)) {
      noteLines.push(line);
    }

    const itemMatch = line.match(ITEM_RE);
    if (itemMatch) {
      const [, description, code, unitPriceRaw, netRaw, qtyRaw] = itemMatch;
      const qtyTks = parseCzNumber(qtyRaw);
      const price = parseCzNumber(unitPriceRaw);
      const netAmount = parseCzNumber(netRaw);
      const quantity =
        qtyTks != null && qtyTks > 0 ? Math.round(qtyTks * 1000) : null;

      items.push({
        itemNo: String(items.length + 1).padStart(5, "0"),
        description: description.trim(),
        customerMaterialNo: code.toUpperCase(),
        yourMaterialNo: null,
        quantity,
        price,
        priceBasis: 1,
        netAmount: netAmount != null && netAmount > 0 ? netAmount : null,
        deliveryDate: null,
      });
    }
  }

  if (!orderNumber) {
    warnings.push('Nepodařilo se najít číslo objednávky (Objednávka zboží číslo).');
  }
  if (!orderDate) {
    warnings.push("Nepodařilo se najít datum objednávky.");
  }
  if (items.length === 0) {
    warnings.push("V PDF nebyly nalezeny žádné položky (kód M… + tks).");
  }
  for (const it of items) {
    if (!it.customerMaterialNo) {
      warnings.push(`Položka ${it.itemNo}: chybí číslo zboží.`);
    }
    if (it.quantity == null || it.quantity <= 0) {
      warnings.push(`Položka ${it.itemNo}: neplatné množství.`);
    }
  }
  if (items.length > 0) {
    warnings.push(
      "Množství v PDF je v MJ „tks“ (tisíc kusů) – převedeno na kusy (* 1000)."
    );
  }

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

export const primatorOrderPdfTemplate: OrderPdfTemplate = {
  key: "primator",
  label: "Primátor (Objednávka zboží)",
  customerHint: "Primátor",
  detect: (text) =>
    /PRIM[ÁA]TOR\s+a\.s\./i.test(text) ||
    (/Objednávka\s+zboží\s+číslo/i.test(text) && /primator\.cz/i.test(text)),
  parse: parsePrimatorOrderText,
};
