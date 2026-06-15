import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { logImlAudit } from "@/lib/iml-audit";
import type { ClassifiedZipFile } from "@/lib/iml-product-import-zip";
import { pdfBufferToJpeg } from "@/lib/iml-product-preview-pdf-server";
import {
  ensureProductThumbnailFromPdf,
  saveProductPreviewImage,
} from "@/lib/iml-product-thumbnail";

export const MAX_PDF_SIZE = 50 * 1024 * 1024;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-()+\s]/g, "_").slice(0, 200) || "soubor";
}

export function isPdfBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  );
}

export function getImageContentType(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e) return "image/png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return "image/gif";
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46)
    return "image/webp";
  return "image/jpeg";
}

export async function attachProductPdf(
  productId: number,
  buffer: Buffer,
  filename: string,
  userId: number
): Promise<void> {
  if (buffer.length > MAX_PDF_SIZE) {
    throw new Error(`PDF je příliš velké (max ${MAX_PDF_SIZE / 1024 / 1024} MB)`);
  }
  if (!isPdfBuffer(buffer)) {
    throw new Error("Soubor není platné PDF");
  }

  const safeName = sanitizeFilename(filename);

  await prisma.$transaction(async (tx) => {
    const latest = await tx.iml_product_files.aggregate({
      where: { product_id: productId },
      _max: { version: true },
    });
    const nextVersion = (latest._max.version ?? 0) + 1;

    await tx.iml_product_files.updateMany({
      where: { product_id: productId, is_primary: true },
      data: { is_primary: false },
    });

    const created = await tx.iml_product_files.create({
      data: {
        product_id: productId,
        version: nextVersion,
        filename: safeName,
        file_size: buffer.length,
        mime_type: "application/pdf",
        pdf_data: Buffer.from(buffer),
        is_primary: true,
        uploaded_by: userId,
      },
    });

    await logImlAudit({
      userId,
      action: "update",
      tableName: "iml_product_files",
      recordId: created.id,
      newValues: {
        product_id: productId,
        version: nextVersion,
        filename: safeName,
        import: true,
      },
    });
  });
}

export async function attachProductPreviewImage(
  productId: number,
  buffer: Buffer,
  userId: number
): Promise<void> {
  await saveProductPreviewImage(productId, buffer, userId, "import");
}

async function loadPreviewBuffer(
  file: ClassifiedZipFile,
  absPath: string
): Promise<Buffer> {
  const raw = await readFile(absPath);
  if (file.ext === ".pdf" || isPdfBuffer(raw)) {
    const jpeg = await pdfBufferToJpeg(raw);
    if (!jpeg) {
      throw new Error(
        "Náhled z PDF na serveru není k dispozici – použijte JPG/PNG pro softproof"
      );
    }
    return jpeg;
  }
  if (!IMAGE_EXT.has(file.ext)) {
    throw new Error(`Nepodporovaný formát náhledu: ${file.ext}`);
  }
  return raw;
}

export type ImportFilesResult = {
  printAttached: number;
  previewAttached: number;
  skippedNoProduct: number;
  errors: string[];
};

export async function importFilesFromExtractedDir(
  rootDir: string,
  files: ClassifiedZipFile[],
  codeToProductId: Map<string, number>,
  userId: number
): Promise<ImportFilesResult> {
  const result: ImportFilesResult = {
    printAttached: 0,
    previewAttached: 0,
    skippedNoProduct: 0,
    errors: [],
  };

  for (const file of files) {
    if (file.kind === "unknown" || !file.productCode) {
      if (file.kind !== "unknown") {
        result.errors.push(`${file.relativePath}: nelze rozpoznat kód produktu`);
      }
      continue;
    }

    const productId = codeToProductId.get(file.productCode);
    if (!productId) {
      result.skippedNoProduct++;
      continue;
    }

    const absPath = path.join(rootDir, file.relativePath);

    try {
      if (file.kind === "print") {
        if (file.ext !== ".pdf") {
          result.errors.push(`${file.relativePath}: tisková data musí být PDF`);
          continue;
        }
        const buf = await readFile(absPath);
        await attachProductPdf(productId, buf, file.basename, userId);
        result.printAttached++;
        try {
          await ensureProductThumbnailFromPdf(productId, buf, userId, {
            onlyIfMissing: true,
          });
        } catch {
          /* miniatura z PDF není kritická pro import */
        }
      } else if (file.kind === "preview") {
        const buf = await loadPreviewBuffer(file, absPath);
        await attachProductPreviewImage(productId, buf, userId);
        result.previewAttached++;
      }
    } catch (e) {
      result.errors.push(
        `${file.relativePath}: ${e instanceof Error ? e.message : "Chyba"}`
      );
    }
  }

  return result;
}

export function buildCodeToProductIdMap(
  products: Array<{ id: number; ig_code: string | null }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of products) {
    if (!p.ig_code) continue;
    map.set(p.ig_code.trim().toUpperCase(), p.id);
  }
  return map;
}
