import { buildPrintColorsSummary } from "@/lib/iml-print-colors-summary";
import { parseCmykFlagsFromBody } from "@/lib/iml/parse-product-body";
import type { IncomingProductColor } from "@/lib/iml-product-colors";

type PreparedColor = { code: string | null; coverage_pct: number };

/** Doplní print_colors_text ze CMYK přepínačů a Pantone řádků při uložení produktu. */
export function applyPrintColorsSummaryOnSave(
  data: { print_colors_text: string | null },
  body: Record<string, unknown>,
  preparedColors: PreparedColor[] | null
): void {
  const colorsTouched = Array.isArray(body.colors);
  const cmykTouched =
    "cmyk_c_enabled" in body ||
    "cmyk_m_enabled" in body ||
    "cmyk_y_enabled" in body ||
    "cmyk_k_enabled" in body;
  if (!colorsTouched && !cmykTouched) return;

  const cmyk = parseCmykFlagsFromBody(body);
  const pantoneRows =
    preparedColors?.map((r) => ({
      code: r.code ?? "",
      coverage_pct: r.coverage_pct,
    })) ??
    (Array.isArray(body.colors)
      ? (body.colors as IncomingProductColor[]).map((r) => ({
          code: String(r.code ?? ""),
          coverage_pct: r.coverage_pct,
        }))
      : []);

  const summary = buildPrintColorsSummary(cmyk, pantoneRows);
  data.print_colors_text = summary || null;
}
