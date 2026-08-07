import { prisma } from "@/lib/db";

/**
 * Vrací true, pokud má produkt PDF v `iml_product_files` (BLOB nebo archiv na disku)
 * nebo legacy `pdf_data` / `pdf_archive_path`. Bez načítání samotných dat.
 */
export async function imlProductHasPdfInFilesTable(productId: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<[{ ok: number | bigint }]>`
    SELECT EXISTS (
      SELECT 1 FROM iml_product_files f
      WHERE f.product_id = ${productId}
        AND (
          (f.pdf_data IS NOT NULL AND OCTET_LENGTH(f.pdf_data) > 0)
          OR (f.archive_path IS NOT NULL AND f.archive_path <> '')
        )
    ) AS ok
  `;
  return Number(rows[0]?.ok ?? 0) === 1;
}

/** True pokud produkt má jakékoli tiskové PDF (soubory nebo legacy). */
export async function imlProductHasAnyPdf(productId: number): Promise<boolean> {
  if (await imlProductHasPdfInFilesTable(productId)) return true;
  const rows = await prisma.$queryRaw<[{ ok: number | bigint }]>`
    SELECT EXISTS (
      SELECT 1 FROM iml_products p
      WHERE p.id = ${productId}
        AND (
          (p.pdf_data IS NOT NULL AND OCTET_LENGTH(p.pdf_data) > 0)
          OR (p.pdf_archive_path IS NOT NULL AND p.pdf_archive_path <> '')
        )
    ) AS ok
  `;
  return Number(rows[0]?.ok ?? 0) === 1;
}
