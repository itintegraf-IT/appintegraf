import type { OrderPdfTemplate, ParsedPdfOrder, ParsedPdfOrderItem } from "./types";
import { normalizeLines, parseCzDate, parseCzNumber } from "./parse-utils";

/**
 * Parser objednávek Fruta Podivín (Helios Inuvio).
 *
 * Extrahovaná struktura:
 *   FRUTA Podivín, a.s. Řada dokladu 050
 *   Číslo dokladu 2600445
 *   Datum pořízení : 13.07.2026
 *   Požadované datum dodání : 27.07.2026
 *   OBJEDNÁVKA
 *   Označení MJ řádek Popis …
 *   OBL7309900009 5 000,00 ks  0,12  600,00  1 Etiketa 180 ALBA …
 *   Celkem bez DPH v CZK
 */

/** Řádek položky: Označení + množství + MJ + cena/ks + celkem + č. řádku + popis. */
const ITEM_RE =
  /^(OBL\d+)\s+([\d\s]+,\d+)\s+ks\s+(\d+,\d+)\s+([\d\s]+,\d+)\s+(\d+)\s+(.+)$/i;

export function parseFrutaOrderText(text: string): ParsedPdfOrder {
  const lines = normalizeLines(text);
  const warnings: string[] = [];
  const items: ParsedPdfOrderItem[] = [];
  const noteLines: string[] = [];

  let rada = "";
  let cisloDokladu = "";
  let orderDate: string | null = null;
  let deliveryDate: string | null = null;
  let currency: string | null = null;
  let totalAmount: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!rada) {
      const m = line.match(/Řada dokladu\s+(\d+)/i);
      if (m) rada = m[1];
    }
    if (!cisloDokladu) {
      const m = line.match(/Číslo dokladu\s+(\d+)/i);
      if (m) cisloDokladu = m[1];
    }

    // Helios: labely nad sebou, pak ": DD.MM.YYYY" řádky v pořadí pořízení → dodání
    if (!orderDate) {
      const same = line.match(/Datum pořízení\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
      if (same) orderDate = parseCzDate(same[1]);
    }

    if (!deliveryDate) {
      const same = line.match(
        /Požadované datum dodání\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{4})/i
      );
      if (same) deliveryDate = parseCzDate(same[1]);
    }

    if ((!orderDate || !deliveryDate) && /^:\s*\d{1,2}\.\d{1,2}\.\d{4}$/.test(line)) {
      const m = line.match(/^:\s*(\d{1,2}\.\d{1,2}\.\d{4})$/);
      if (m) {
        const iso = parseCzDate(m[1]);
        if (!orderDate) orderDate = iso;
        else if (!deliveryDate) deliveryDate = iso;
      }
    }

    if (!currency && /Celkem bez DPH\s+v\s+([A-Z]{3})/i.test(line)) {
      const m = line.match(/Celkem bez DPH\s+v\s+([A-Z]{3})/i);
      if (m) currency = m[1];
    }

    if (totalAmount == null && /Celkem bez DPH/i.test(line)) {
      const m = line.match(/([\d\s]+,\d+)\s*Celkem bez DPH/i);
      if (m) totalAmount = parseCzNumber(m[1]);
      else {
        // číslo může být na předchozím řádku
        const prev = lines[i - 1] ?? "";
        const pm = prev.match(/^([\d\s]+,\d+)\s*$/);
        if (pm) totalAmount = parseCzNumber(pm[1]);
      }
    }

    const itemMatch = line.match(ITEM_RE);
    if (itemMatch) {
      const [, oznaceni, qtyRaw, unitPriceRaw, netRaw, itemNo, description] = itemMatch;
      const quantity = parseCzNumber(qtyRaw);
      const price = parseCzNumber(unitPriceRaw);
      const netAmount = parseCzNumber(netRaw);
      items.push({
        itemNo,
        description: description.trim(),
        customerMaterialNo: oznaceni.toUpperCase(),
        yourMaterialNo: null,
        quantity: quantity != null ? Math.round(quantity) : null,
        price,
        priceBasis: 1,
        netAmount,
        deliveryDate,
      });
      continue;
    }

    if (
      /Prosím o potvrzení|Na faktuře|Byla zkontrolována|Děkuji/i.test(line)
    ) {
      noteLines.push(line);
    }
  }

  const orderNumber =
    rada && cisloDokladu ? `${rada}${cisloDokladu}` : cisloDokladu;

  if (!orderNumber) {
    warnings.push("Nepodařilo se najít číslo dokladu (Řada + Číslo dokladu).");
  }
  if (items.length === 0) {
    warnings.push("V PDF nebyly nalezeny žádné položky (označení OBL…).");
  }
  for (const it of items) {
    if (!it.customerMaterialNo) {
      warnings.push(`Položka ${it.itemNo}: chybí označení produktu.`);
    }
    if (it.quantity == null || it.quantity <= 0) {
      warnings.push(`Položka ${it.itemNo}: neplatné množství.`);
    }
  }

  return {
    orderNumber,
    orderDate,
    currency: currency ?? "CZK",
    items,
    notes: noteLines.join("\n"),
    totalAmount,
    warnings,
  };
}

export const frutaOrderPdfTemplate: OrderPdfTemplate = {
  key: "fruta",
  label: "Fruta Podivín (Helios)",
  customerHint: "Fruta",
  detect: (text) =>
    /FRUTA\s+Podiv[ií]n/i.test(text) && /OBJEDNÁVKA/i.test(text),
  parse: parseFrutaOrderText,
};
