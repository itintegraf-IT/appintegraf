/** Sjednocené limity nahrávání souborů u IML produktů. */

export const MAX_PRODUCT_PDF_BYTES = 100 * 1024 * 1024;
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
/** PDF → náhled v prohlížeči (softproof); větší PDF nahrát jako tisková data. */
export const MAX_PREVIEW_SOURCE_PDF_BYTES = 15 * 1024 * 1024;

export const MAX_PRODUCT_PDF_MB = MAX_PRODUCT_PDF_BYTES / 1024 / 1024;
export const MAX_PRODUCT_IMAGE_MB = MAX_PRODUCT_IMAGE_BYTES / 1024 / 1024;
export const MAX_PREVIEW_SOURCE_PDF_MB = MAX_PREVIEW_SOURCE_PDF_BYTES / 1024 / 1024;

/** @deprecated Použijte MAX_PRODUCT_PDF_BYTES */
export const MAX_PDF_SIZE = MAX_PRODUCT_PDF_BYTES;

/** @deprecated Použijte MAX_PRODUCT_IMAGE_BYTES */
export const MAX_IMAGE_SIZE = MAX_PRODUCT_IMAGE_BYTES;

/** @deprecated Použijte MAX_PREVIEW_SOURCE_PDF_BYTES */
export const MAX_PREVIEW_PDF_BYTES = MAX_PREVIEW_SOURCE_PDF_BYTES;

export function validateProductPdfSize(byteLength: number): void {
  if (byteLength > MAX_PRODUCT_PDF_BYTES) {
    throw new Error(
      `PDF je příliš velké (max ${Math.round(MAX_PRODUCT_PDF_MB)} MB)`
    );
  }
}
