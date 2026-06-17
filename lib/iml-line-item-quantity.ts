/** Vrátí chybovou hlášku, pokud nějaká položka má produkt ale neplatné množství. */
export function validateLineItemQuantities(items: unknown): string | null {
  if (!Array.isArray(items)) return null;
  for (const it of items) {
    const row = it as { product_id?: unknown; quantity?: unknown };
    const productId = parseInt(String(row.product_id ?? ""), 10);
    if (!productId) continue;
    const quantity = parseInt(String(row.quantity ?? ""), 10);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return "Každá položka musí mít množství větší než 0.";
    }
  }
  return null;
}
