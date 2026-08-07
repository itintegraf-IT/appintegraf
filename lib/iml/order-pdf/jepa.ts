import type { OrderPdfTemplate, ParsedPdfOrder, ParsedPdfOrderItem } from "./types";
import { normalizeLines, parseCzDate, parseCzNumber } from "./parse-utils";

/**
 * Parser JEPA Plastics (OBJEDNÁVKA č.).
 *
 *   OBJEDNÁVKA č.:  25096
 *   ze dne:  13.10.2025
 *   03.11.2025                    ← požadovaný termín dodání
 *   …
 *   04-03-040 JME3502 Bio Matylda bílá  -  ks 0,195  -
 *   01-03-107 JME3590 Kozí jog. bílý BIO  80 000 ks 0,195  15 600,00
 *   NOVÝ  JME3591 Kozí jog. bifido …  -  ks 0,195  -
 *
 * Číslo dodavatele (04-03-040) → yourMaterialNo / ig_code
 * Číslo odběratele (JME3502) → customerMaterialNo / client_code
 * Množství "-" = 0 / položka bez objednávky (vynecháme z importu nebo qty null)
 */

function parseQty(raw: string): number | null {
  const t = raw.trim();
  if (!t || t === "-") return null;
  const n = parseCzNumber(t);
  return n != null ? Math.round(n) : null;
}

export function parseJepaOrderText(text: string): ParsedPdfOrder {
  const lines = normalizeLines(text);
  const warnings: string[] = [];
  const items: ParsedPdfOrderItem[] = [];
  const noteLines: string[] = [];

  let orderNumber = "";
  let orderDate: string | null = null;
  let deliveryDate: string | null = null;
  let currency: string | null = "CZK";
  let totalAmount: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!orderNumber) {
      const m = line.match(/OBJEDNÁVKA\s*č\.?:\s*(\S+)/i);
      if (m) orderNumber = m[1];
    }
    if (!orderDate) {
      const m = line.match(/ze dne:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
      if (m) orderDate = parseCzDate(m[1]);
    }
    if (/Požadovaný termín dodání/i.test(line)) {
      // datum bývá výše u hlavičky
    }
    if (/Celkem Kč bez DPH/i.test(line)) {
      const m = line.match(/([\d\s]+,\d{2})/);
      if (m) totalAmount = parseCzNumber(m[1]);
    }
  }

  // Termín dodání – datum hned pod „ze dne“
  if (orderDate) {
    for (let i = 0; i < lines.length; i++) {
      if (/ze dne:/i.test(lines[i])) {
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const d = parseCzDate(lines[j]);
          if (d && d !== orderDate) {
            deliveryDate = d;
            break;
          }
        }
        break;
      }
    }
  }

  // Položky: [kód_dodavatele|NOVÝ] JME#### popis množství? ks cena [celkem|-]
  const itemRe =
    /^(?:([0-9]{2}-[0-9]{2}-[0-9]{3}(?:_\S+)?)|(NOVÝ))\s+(JME\d+)\s+(.+?)\s+(?:-\s+ks|([\d\s]+)\s*ks)\s+([\d,]+)(?:\s+([\d\s]+,\d{2}|-))?$/i;

  for (const line of lines) {
    if (/Místo dodání:|Pracovní doba:|Prosím o potvrzení|Číslo objednávky prosím/i.test(line)) {
      noteLines.push(line);
      continue;
    }

    const m = line.match(itemRe);
    if (!m) continue;

    const supplierCode = m[1] && m[1].toUpperCase() !== "NOVÝ" ? m[1] : null;
    const isNew = (m[1]?.toUpperCase() === "NOVÝ") || (m[2]?.toUpperCase() === "NOVÝ");
    const clientCode = m[3];
    const description = m[4].trim().replace(/\s+-\s*$/, "").trim();
    const qty = parseQty(m[5] ?? "-");
    const unitPrice = parseCzNumber(m[6]);
    let net: number | null = null;
    if (m[7] && m[7] !== "-") net = parseCzNumber(m[7]);

    // Položky s množstvím "-" jsou ceníkové řádky bez objednávky – přeskočíme
    if (qty == null || qty <= 0) continue;

    items.push({
      itemNo: String(items.length + 1).padStart(5, "0"),
      description: isNew && !supplierCode ? `NOVÝ ${description}` : description,
      customerMaterialNo: clientCode,
      yourMaterialNo: supplierCode,
      quantity: qty,
      price: unitPrice,
      priceBasis: 1,
      netAmount: net,
      deliveryDate,
    });
  }

  if (!orderNumber) warnings.push("V PDF se nepodařilo najít číslo objednávky.");
  if (!orderDate) warnings.push("V PDF se nepodařilo najít datum objednávky.");
  if (items.length === 0) warnings.push("V PDF se nepodařilo najít položky s množstvím > 0.");

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

export const jepaOrderPdfTemplate: OrderPdfTemplate = {
  key: "jepa",
  label: "JEPA Plastics (OBJEDNÁVKA č.)",
  customerHint: "JEPA",
  detect: (text) => /JEPA Plastics/i.test(text) || /OBJEDNÁVKA\s*č\.:/i.test(text),
  parse: parseJepaOrderText,
};
