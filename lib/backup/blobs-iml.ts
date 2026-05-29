import type { BackupTableDef } from "@/lib/backup/types";

export function imlProductImageBlobPath(productId: number): string {
  return `blobs/iml/products/${productId}/image.bin`;
}

export function imlProductPdfBlobPath(productId: number): string {
  return `blobs/iml/products/${productId}/legacy-pdf.bin`;
}

export function imlProductFileBlobPath(productId: number, fileId: number): string {
  return `blobs/iml/product-files/${productId}/${fileId}.pdf`;
}

export function extractBlobRefsForRow(
  table: BackupTableDef,
  row: Record<string, unknown>
): Record<string, string> {
  const refs: Record<string, string> = {};
  if (!table.blobColumns?.length) return refs;

  const id = Number(row.id);
  if (!Number.isFinite(id)) return refs;

  if (table.name === "iml_products") {
    if (table.blobColumns.includes("image_data") && row.image_data) {
      refs.image_data = imlProductImageBlobPath(id);
    }
    if (table.blobColumns.includes("pdf_data") && row.pdf_data) {
      refs.pdf_data = imlProductPdfPath(id);
    }
  }

  if (table.name === "iml_product_files" && table.blobColumns.includes("pdf_data") && row.pdf_data) {
    const productId = Number(row.product_id);
    refs.pdf_data = imlProductFileBlobPath(productId, id);
  }

  return refs;
}

function imlProductPdfPath(productId: number): string {
  return imlProductPdfBlobPath(productId);
}
