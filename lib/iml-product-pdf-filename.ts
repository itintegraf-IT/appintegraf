/**
 * Název staženého výrobního PDF z polí produktu:
 * {ig_code}_{client_name}_{druh}.pdf
 */

import { imlProductKindLabel } from "@/lib/iml-constants";

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Krátký druh pro název souboru: „IML (plast)“ → „IML“. */
export function productKindFilenameSegment(productKind: string | null | undefined): string {
  const label = imlProductKindLabel(productKind);
  const short = label.split("(")[0]?.trim() || label;
  return sanitizeFilenameSegment(short) || "IML";
}

export function sanitizeFilenameSegment(raw: string): string {
  return stripDiacritics(raw)
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function buildImlProductPdfFilename(product: {
  id: number;
  ig_code?: string | null;
  client_name?: string | null;
  product_kind?: string | null;
}): string {
  const parts = [
    sanitizeFilenameSegment(product.ig_code ?? ""),
    sanitizeFilenameSegment(product.client_name ?? ""),
    productKindFilenameSegment(product.product_kind),
  ].filter(Boolean);

  const base = parts.length > 0 ? parts.join("_") : `produkt-${product.id}`;
  const sliced = base.slice(0, 150);
  return sliced.toLowerCase().endsWith(".pdf") ? sliced : `${sliced}.pdf`;
}

/**
 * Preferuje uložený název souboru (kontinuita Grafika → IML).
 * Generovaný název jen pro legacy placeholder `tiskova-data.pdf`.
 */
export function preferStoredPdfDownloadName(
  storedFilename: string | null | undefined,
  product: {
    id: number;
    ig_code?: string | null;
    client_name?: string | null;
    product_kind?: string | null;
  }
): string {
  const stored = storedFilename?.trim();
  if (stored && stored.toLowerCase() !== "tiskova-data.pdf") {
    return stored;
  }
  return buildImlProductPdfFilename(product);
}

/** ASCII-only pro Content-Disposition filename= */
export function asciiFilenameForDisposition(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "tiskova-data.pdf";
  const cleaned =
    stripDiacritics(base)
      .replace(/[^\w.\-() ]+/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 150) || "tiskova-data.pdf";
  return cleaned;
}

export function contentDispositionForPdf(
  filename: string,
  mode: "inline" | "attachment"
): string {
  const name = (filename || "tiskova-data.pdf").replace(/[\r\n"]/g, "_").trim() || "tiskova-data.pdf";
  const ascii = asciiFilenameForDisposition(name);
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
