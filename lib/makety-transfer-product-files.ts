import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { MAKETY_FILE_MODULE, resolveMaketyFileDiskPath } from "@/lib/makety-files";
import type { MaketyFileKind } from "@/lib/makety-file-kind";
import {
  attachProductPdf,
  attachProductPreviewImage,
  isPdfBuffer,
} from "@/lib/iml-product-import-files";
import { pdfBufferToJpeg } from "@/lib/iml-product-preview-pdf-server";
import { ensureProductThumbnailFromPdf } from "@/lib/iml-product-thumbnail";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export type MaketyFileRow = {
  id: number;
  file_path: string;
  original_filename: string;
  document_type: string | null;
  created_at: Date;
};

/** Vybere nejnovější soubor daného typu (softproof / print_data). */
export function pickLatestMaketyFileByKind(
  files: MaketyFileRow[],
  kind: MaketyFileKind
): MaketyFileRow | null {
  let latest: MaketyFileRow | null = null;
  for (const file of files) {
    if (file.document_type !== kind) continue;
    if (!latest || file.created_at.getTime() > latest.created_at.getTime()) {
      latest = file;
    }
  }
  return latest;
}

async function readMaketyFileBuffer(file: MaketyFileRow): Promise<Buffer | null> {
  const diskPath = resolveMaketyFileDiskPath(file.file_path);
  if (!diskPath) return null;
  try {
    return await readFile(diskPath);
  } catch {
    return null;
  }
}

async function attachSoftproofFromBuffer(
  productId: number,
  buffer: Buffer,
  originalFilename: string,
  userId: number
): Promise<void> {
  const ext = path.extname(originalFilename).toLowerCase();
  let previewBuffer: Buffer;
  if (IMAGE_EXT.has(ext) && !isPdfBuffer(buffer)) {
    previewBuffer = buffer;
  } else if (isPdfBuffer(buffer) || ext === ".pdf") {
    const jpeg = await pdfBufferToJpeg(buffer);
    if (!jpeg) {
      throw new Error(
        "Softproof PDF nelze převést na náhled – nahrajte JPG/PNG nebo ověřte PDF službu"
      );
    }
    previewBuffer = jpeg;
  } else {
    throw new Error(`Nepodporovaný formát softproofu: ${ext || "neznámý"}`);
  }
  await attachProductPreviewImage(productId, previewBuffer, userId);
}

export type TransferMaketyFilesResult = {
  softproofAttached: boolean;
  printDataAttached: boolean;
  warnings: string[];
};

export async function transferMaketyFilesToImlProduct(
  maketaId: number,
  productId: number,
  userId: number
): Promise<TransferMaketyFilesResult> {
  const result: TransferMaketyFilesResult = {
    softproofAttached: false,
    printDataAttached: false,
    warnings: [],
  };

  const files = await prisma.file_uploads.findMany({
    where: {
      module: MAKETY_FILE_MODULE,
      record_id: maketaId,
      document_type: { in: ["softproof", "print_data"] },
    },
    select: {
      id: true,
      file_path: true,
      original_filename: true,
      document_type: true,
      created_at: true,
    },
  });

  const softproof = pickLatestMaketyFileByKind(files, "softproof");
  const printData = pickLatestMaketyFileByKind(files, "print_data");

  if (softproof) {
    const buffer = await readMaketyFileBuffer(softproof);
    if (!buffer) {
      result.warnings.push("Softproof: soubor na disku nenalezen");
    } else {
      try {
        await attachSoftproofFromBuffer(
          productId,
          buffer,
          softproof.original_filename,
          userId
        );
        result.softproofAttached = true;
      } catch (e) {
        result.warnings.push(
          `Softproof: ${e instanceof Error ? e.message : "Chyba při nahrání"}`
        );
      }
    }
  } else {
    result.warnings.push("Softproof: u zakázky není nahraný soubor");
  }

  if (printData) {
    const buffer = await readMaketyFileBuffer(printData);
    if (!buffer) {
      result.warnings.push("Tisková data: soubor na disku nenalezen");
    } else {
      try {
        await attachProductPdf(
          productId,
          buffer,
          printData.original_filename,
          userId
        );
        result.printDataAttached = true;
        try {
          await ensureProductThumbnailFromPdf(productId, buffer, userId, {
            onlyIfMissing: true,
          });
        } catch {
          /* miniatura není kritická */
        }
      } catch (e) {
        result.warnings.push(
          `Tisková data: ${e instanceof Error ? e.message : "Chyba při nahrání"}`
        );
      }
    }
  } else {
    result.warnings.push("Tisková data: u zakázky není nahraný soubor");
  }

  return result;
}
