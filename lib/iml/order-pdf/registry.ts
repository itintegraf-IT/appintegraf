import type { OrderPdfTemplate } from "./types";
import { orklaOrderPdfTemplate } from "./orkla";
import { psPlastyOrderPdfTemplate } from "./psplasty";
import { sfaOrderPdfTemplate } from "./sfa";
import { jepaOrderPdfTemplate } from "./jepa";
import { jokeyOrderPdfTemplate } from "./jokey";
import { frutaOrderPdfTemplate } from "./fruta";
import { primatorOrderPdfTemplate } from "./primator";

/** Šablony PDF objednávek – nové zákazníky přidávej sem. */
export const ORDER_PDF_TEMPLATES: OrderPdfTemplate[] = [
  orklaOrderPdfTemplate,
  psPlastyOrderPdfTemplate,
  sfaOrderPdfTemplate,
  jepaOrderPdfTemplate,
  jokeyOrderPdfTemplate,
  frutaOrderPdfTemplate,
  primatorOrderPdfTemplate,
];

export function getOrderPdfTemplate(key: string): OrderPdfTemplate | null {
  if (!key || key === "auto") return null;
  return ORDER_PDF_TEMPLATES.find((t) => t.key === key) ?? null;
}

/** Automatický výběr šablony podle obsahu PDF (první match v pořadí registru). */
export function detectOrderPdfTemplate(text: string): OrderPdfTemplate | null {
  return ORDER_PDF_TEMPLATES.find((t) => t.detect(text)) ?? null;
}

export function resolveOrderPdfTemplate(
  key: string | null | undefined,
  text: string
): OrderPdfTemplate | null {
  if (key && key !== "auto") {
    return getOrderPdfTemplate(key);
  }
  return detectOrderPdfTemplate(text);
}
