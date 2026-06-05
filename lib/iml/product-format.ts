/**
 * Formát etikety – šířka/výška v mm a odvozený textový řetězec pro export/zobrazení.
 */

function formatMmDisplay(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
}

/** Složí zobrazovací formát z rozměrů v mm, např. "45 × 30 mm". */
export function formatProductFormatFromMm(
  widthMm: number | null | undefined,
  heightMm: number | null | undefined
): string | null {
  if (
    widthMm == null ||
    heightMm == null ||
    !Number.isFinite(widthMm) ||
    !Number.isFinite(heightMm) ||
    widthMm <= 0 ||
    heightMm <= 0
  ) {
    return null;
  }
  return `${formatMmDisplay(widthMm)} × ${formatMmDisplay(heightMm)} mm`;
}

/** Pokus o extrakci š/v z textu product_format (zpětná kompatibilita importu). */
export function parseProductFormatToMm(
  text: string | null | undefined
): { width: number; height: number } | null {
  if (!text?.trim()) return null;
  const m = text.trim().match(/(\d+(?:[.,]\d+)?)\s*[×xX]\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const width = parseFloat(m[1].replace(",", "."));
  const height = parseFloat(m[2].replace(",", "."));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

/**
 * Priorita: obě mm hodnoty → složený text; jinak ponechat ruční product_format.
 */
export function syncProductFormatFromMm(
  widthMm: number | null | undefined,
  heightMm: number | null | undefined,
  existingText?: string | null
): string | null {
  const fromMm = formatProductFormatFromMm(widthMm, heightMm);
  if (fromMm) return fromMm;
  const trimmed = existingText?.trim();
  return trimmed || null;
}
