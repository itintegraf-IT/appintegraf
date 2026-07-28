import type { OrderPdfTemplate } from "./types";
import { orklaOrderPdfTemplate } from "./orkla";

/** Šablony PDF objednávek – nové zákazníky přidávej sem. */
export const ORDER_PDF_TEMPLATES: OrderPdfTemplate[] = [orklaOrderPdfTemplate];

export function getOrderPdfTemplate(key: string): OrderPdfTemplate | null {
  return ORDER_PDF_TEMPLATES.find((t) => t.key === key) ?? null;
}
