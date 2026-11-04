/** Tisk je bezpečný jen ze stavu „aktivní“ (`iml_products.item_status`). */
export function isImlProductPrintSafe(
  itemStatus: string | null | undefined
): boolean {
  return (itemStatus?.trim() ?? "") === "aktivní";
}

export function imlProductPrintSafeFlag(
  itemStatus: string | null | undefined
): "true" | "false" {
  return isImlProductPrintSafe(itemStatus) ? "true" : "false";
}

/**
 * Varování pro export — prázdné při PrintSafe, jinak jasný text.
 * `productMissing`: řádek bez navázaného produktu.
 */
export function imlProductPrintWarning(
  itemStatus: string | null | undefined,
  opts?: { productMissing?: boolean }
): string {
  if (opts?.productMissing) {
    return "POZOR: chybí produkt";
  }
  if (isImlProductPrintSafe(itemStatus)) {
    return "";
  }
  const st = itemStatus?.trim() || "bez stavu";
  return `POZOR: produkt není aktivní (stav: ${st})`;
}
