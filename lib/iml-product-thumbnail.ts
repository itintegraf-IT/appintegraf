import { prisma } from "@/lib/db";
import { logImlAudit } from "@/lib/iml-audit";
import { pdfBufferToJpeg, isPdfThumbnailGenerationAvailable } from "@/lib/iml-product-preview-pdf-server";

const MAX_PREVIEW_IMAGE_BYTES = 5 * 1024 * 1024;

/** Rozměr miniatury pro seznam produktů (JPEG). */
export const LIST_THUMB_MAX_SIDE = 256;
export const LIST_THUMB_JPEG_QUALITY = 0.82;

export async function productHasPreviewImage(productId: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ has_image: number }>>`
    SELECT CASE
      WHEN image_data IS NOT NULL AND OCTET_LENGTH(image_data) > 0 THEN 1
      ELSE 0
    END AS has_image
    FROM iml_products
    WHERE id = ${productId}
  `;
  return Number(rows[0]?.has_image) === 1;
}

export async function saveProductPreviewImage(
  productId: number,
  buffer: Buffer,
  userId: number,
  source: "upload" | "import" | "backfill" | "pdf_thumb" = "pdf_thumb"
): Promise<void> {
  if (buffer.length > MAX_PREVIEW_IMAGE_BYTES) {
    throw new Error(`Miniatura je příliš velká (max ${MAX_PREVIEW_IMAGE_BYTES / 1024 / 1024} MB)`);
  }

  await prisma.iml_products.update({
    where: { id: productId },
    data: { image_data: Buffer.from(buffer) },
  });

  await logImlAudit({
    userId,
    action: "update",
    tableName: "iml_products",
    recordId: productId,
    newValues: { image_uploaded: true, thumbnail_source: source },
  });
}

/**
 * Vygeneruje JPEG z první stránky PDF a uloží do image_data.
 * @returns true pokud se miniatura vytvořila
 */
export async function ensureProductThumbnailFromPdf(
  productId: number,
  pdfBuffer: Buffer,
  userId: number,
  opts?: { onlyIfMissing?: boolean }
): Promise<boolean> {
  if (opts?.onlyIfMissing !== false && (await productHasPreviewImage(productId))) {
    return false;
  }

  const jpeg = await pdfBufferToJpeg(pdfBuffer, {
    maxSide: LIST_THUMB_MAX_SIDE,
    jpegQuality: LIST_THUMB_JPEG_QUALITY,
  });
  if (!jpeg) return false;

  await saveProductPreviewImage(productId, jpeg, userId, "pdf_thumb");
  return true;
}

export async function loadPrimaryPdfBuffer(productId: number): Promise<Buffer | null> {
  const fileRow = await prisma.iml_product_files.findFirst({
    where: { product_id: productId, is_primary: true },
    orderBy: { version: "desc" },
    select: { pdf_data: true },
  });
  if (fileRow?.pdf_data && fileRow.pdf_data.length > 0) {
    return Buffer.isBuffer(fileRow.pdf_data) ? fileRow.pdf_data : Buffer.from(fileRow.pdf_data);
  }

  const legacy = await prisma.iml_products.findUnique({
    where: { id: productId },
    select: { pdf_data: true },
  });
  if (legacy?.pdf_data && legacy.pdf_data.length > 0) {
    return Buffer.isBuffer(legacy.pdf_data) ? legacy.pdf_data : Buffer.from(legacy.pdf_data);
  }

  return null;
}

export type BackfillThumbnailsResult = {
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  errors: string[];
};

/** Počet produktů s PDF, které nemají uloženou miniaturu (image_data). */
export async function countProductsNeedingThumbnail(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt
    FROM iml_products p
    WHERE (p.image_data IS NULL OR OCTET_LENGTH(p.image_data) = 0)
      AND (
        (p.pdf_data IS NOT NULL AND OCTET_LENGTH(p.pdf_data) > 0)
        OR EXISTS (
          SELECT 1 FROM iml_product_files f
          WHERE f.product_id = p.id
            AND f.is_primary = 1
            AND f.pdf_data IS NOT NULL
            AND OCTET_LENGTH(f.pdf_data) > 0
        )
      )
  `;
  return Number(rows[0]?.cnt ?? 0);
}

export { isPdfThumbnailGenerationAvailable };

/** Dávkové doplnění miniatur z PDF u produktů bez image_data. */
export async function backfillProductThumbnailsFromPdf(
  userId: number,
  limit = 50
): Promise<BackfillThumbnailsResult> {
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT p.id
    FROM iml_products p
    WHERE (p.image_data IS NULL OR OCTET_LENGTH(p.image_data) = 0)
      AND (
        (p.pdf_data IS NOT NULL AND OCTET_LENGTH(p.pdf_data) > 0)
        OR EXISTS (
          SELECT 1 FROM iml_product_files f
          WHERE f.product_id = p.id
            AND f.is_primary = 1
            AND f.pdf_data IS NOT NULL
            AND OCTET_LENGTH(f.pdf_data) > 0
        )
      )
    ORDER BY p.id ASC
    LIMIT ${limit}
  `;

  const result: BackfillThumbnailsResult = {
    processed: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const row of rows) {
    result.processed++;
    const productId = Number(row.id);
    try {
      const pdf = await loadPrimaryPdfBuffer(productId);
      if (!pdf) {
        result.skipped++;
        continue;
      }
      const ok = await ensureProductThumbnailFromPdf(productId, pdf, userId, {
        onlyIfMissing: true,
      });
      if (ok) result.created++;
      else result.skipped++;
    } catch (e) {
      result.failed++;
      result.errors.push(
        `Produkt ${productId}: ${e instanceof Error ? e.message : "Chyba"}`
      );
    }
  }

  return result;
}
