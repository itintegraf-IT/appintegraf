import { resolveProductPdfBuffer } from "@/lib/iml-product-archive";
import {
  getImageContentType,
  sanitizeFilename,
} from "@/lib/iml-product-import-files";

export const PRODUCT_EXPORT_ASSETS_MAX_ROWS = 500;
export const PRODUCT_EXPORT_ASSETS_FOLDER = "soubory";

export type ProductExportAssetOptions = {
  includePrint: boolean;
  includeSoftproof: boolean;
};

export type ProductExportAssetFile = {
  productId: number;
  igCode: string | null;
  zipPath: string;
  buffer: Buffer;
};

export type ProductAssetPathMap = Map<
  number,
  { soubor_tisk?: string; soubor_softproof?: string }
>;

export function parseProductExportAssetOptions(input: {
  include_print?: unknown;
  include_softproof?: unknown;
  includePrint?: unknown;
  includeSoftproof?: unknown;
}): ProductExportAssetOptions {
  const truthy = (v: unknown) =>
    v === true || v === 1 || v === "1" || v === "true";
  return {
    includePrint: truthy(input.include_print) || truthy(input.includePrint),
    includeSoftproof:
      truthy(input.include_softproof) || truthy(input.includeSoftproof),
  };
}

export function hasProductExportAssets(opts: ProductExportAssetOptions): boolean {
  return opts.includePrint || opts.includeSoftproof;
}

/** Sanitizovaný basename pro soubory v ZIP (ig_code nebo produkt-{id}). */
export function buildExportAssetBasename(
  igCode: string | null | undefined,
  productId: number
): string {
  const raw = igCode?.trim();
  if (raw) {
    const safe = sanitizeFilename(raw).replace(/\s+/g, "-").slice(0, 80);
    if (safe) return safe;
  }
  return `produkt-${productId}`;
}

function softproofExtension(buffer: Buffer): string {
  const mime = getImageContentType(buffer);
  if (mime === "image/png") return ".png";
  if (mime === "image/gif") return ".gif";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

function toBuffer(data: Buffer | Uint8Array | null | undefined): Buffer | null {
  if (data == null) return null;
  if (Buffer.isBuffer(data)) return data.length > 0 ? data : null;
  const buf = Buffer.from(data);
  return buf.length > 0 ? buf : null;
}

function allocateUniqueBasename(
  base: string,
  used: Map<string, number>
): string {
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  if (count === 0) return base;
  return `${base}-v${count + 1}`;
}

export type ProductForAssetExport = {
  id: number;
  ig_code: string | null;
  image_data?: Buffer | Uint8Array | null;
};

export async function collectProductExportAssets(
  products: ProductForAssetExport[],
  opts: ProductExportAssetOptions
): Promise<{ files: ProductExportAssetFile[]; paths: ProductAssetPathMap }> {
  const files: ProductExportAssetFile[] = [];
  const paths: ProductAssetPathMap = new Map();
  const usedBasenames = new Map<string, number>();

  for (const product of products) {
    const base = allocateUniqueBasename(
      buildExportAssetBasename(product.ig_code, product.id),
      usedBasenames
    );
    const entry: { soubor_tisk?: string; soubor_softproof?: string } = {};

    if (opts.includePrint) {
      const pdf = await resolveProductPdfBuffer(product.id, { touchAccess: false });
      if (pdf?.buffer?.length) {
        const zipPath = `${PRODUCT_EXPORT_ASSETS_FOLDER}/${base}-tisk.pdf`;
        files.push({
          productId: product.id,
          igCode: product.ig_code,
          zipPath,
          buffer: pdf.buffer,
        });
        entry.soubor_tisk = zipPath;
      }
    }

    if (opts.includeSoftproof) {
      const imageBuffer = toBuffer(product.image_data ?? null);
      if (imageBuffer) {
        const ext = softproofExtension(imageBuffer);
        const zipPath = `${PRODUCT_EXPORT_ASSETS_FOLDER}/${base}-softproof${ext}`;
        files.push({
          productId: product.id,
          igCode: product.ig_code,
          zipPath,
          buffer: imageBuffer,
        });
        entry.soubor_softproof = zipPath;
      }
    }

    if (entry.soubor_tisk || entry.soubor_softproof) {
      paths.set(product.id, entry);
    }
  }

  return { files, paths };
}

export function assetPathForProduct(
  paths: ProductAssetPathMap,
  productId: number,
  kind: "soubor_tisk" | "soubor_softproof"
): string {
  return paths.get(productId)?.[kind] ?? "";
}
