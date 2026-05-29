import { prisma } from "@/lib/db";

/**
 * Vrací true, pokud má produkt aspoň jednu verzi PDF v `iml_product_files`
 * s neprázdným blobem. Bez načítání samotných dat (jen EXISTS / metadata).
 */
export async function imlProductHasPdfInFilesTable(productId: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<[{ ok: number | bigint }]>`
    SELECT EXISTS (
      SELECT 1 FROM iml_product_files f
      WHERE f.product_id = ${productId}
        AND f.pdf_data IS NOT NULL
        AND OCTET_LENGTH(f.pdf_data) > 0
    ) AS ok
  `;
  return Number(rows[0]?.ok ?? 0) === 1;
}
