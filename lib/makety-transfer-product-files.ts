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
  /** U makety existuje soubor typu softproof. */
  hadSoftproofOnMaketa: boolean;
  /** U makety existuje soubor typu print_data. */
  hadPrintDataOnMaketa: boolean;
  /**
   * True, pokud se očekávaný soubor nepropsal (zejména ostrá data, když u makety jsou).
   * Softproof chybějící u makety = warning, ale ne incomplete (ostrá data mají prioritu).
   */
  filesIncomplete: boolean;
  warnings: string[];
};

/** Odvození filesIncomplete z výsledku transferu. */
export function isMaketyImlFilesIncomplete(
  result: Pick<
    TransferMaketyFilesResult,
    "hadPrintDataOnMaketa" | "printDataAttached" | "hadSoftproofOnMaketa" | "softproofAttached"
  >
): boolean {
  if (result.hadPrintDataOnMaketa && !result.printDataAttached) return true;
  if (result.hadSoftproofOnMaketa && !result.softproofAttached) return true;
  return false;
}

/**
 * Stav souborů po překlopení (pro UI bez nutnosti znovu transferovat).
 * Incomplete = u makety je print_data, ale produkt nemá PDF v iml_product_files;
 * nebo je jen softproof a na produktu chybí náhled.
 */
export async function getMaketyImlFileTransferStatus(
  maketaId: number,
  productId: number | null
): Promise<{
  hadSoftproofOnMaketa: boolean;
  hadPrintDataOnMaketa: boolean;
  softproofOnProduct: boolean;
  printDataOnProduct: boolean;
  filesIncomplete: boolean;
}> {
  const files = await prisma.file_uploads.findMany({
    where: {
      module: MAKETY_FILE_MODULE,
      record_id: maketaId,
      document_type: { in: ["softproof", "print_data"] },
    },
    select: { document_type: true },
  });
  const hadSoftproofOnMaketa = files.some((f) => f.document_type === "softproof");
  const hadPrintDataOnMaketa = files.some((f) => f.document_type === "print_data");

  let softproofOnProduct = false;
  let printDataOnProduct = false;
  if (productId != null) {
    const [blobFlags, fileCount] = await Promise.all([
      prisma.$queryRaw<Array<{ has_preview: number | boolean }>>`
        SELECT (image_data IS NOT NULL) AS has_preview
        FROM iml_products WHERE id = ${productId}
      `,
      prisma.iml_product_files.count({ where: { product_id: productId } }),
    ]);
    softproofOnProduct = Boolean(blobFlags[0]?.has_preview);
    printDataOnProduct = fileCount > 0;
  }

  const filesIncomplete =
    (hadPrintDataOnMaketa && !printDataOnProduct) ||
    (hadSoftproofOnMaketa && !hadPrintDataOnMaketa && !softproofOnProduct);

  return {
    hadSoftproofOnMaketa,
    hadPrintDataOnMaketa,
    softproofOnProduct,
    printDataOnProduct,
    filesIncomplete,
  };
}

/** Jednoznačnější incomplete: chybí ostrá data, když je měla maketa; nebo chybí softproof když byl jediný soubor. */
export function summarizeTransferForUser(files: TransferMaketyFilesResult): {
  summary: string;
  incomplete: boolean;
} {
  const parts: string[] = [];
  if (files.softproofAttached) parts.push("softproof");
  if (files.printDataAttached) parts.push("tisková data");
  const incomplete = isMaketyImlFilesIncomplete(files);
  let summary =
    parts.length > 0
      ? `Přeneseno: ${parts.join(", ")}.`
      : "Do IML se nepřenesl žádný soubor.";
  if (files.warnings.length > 0) {
    summary += ` ${files.warnings.join(" ")}`;
  }
  return { summary: summary.trim(), incomplete };
}

export async function transferMaketyFilesToImlProduct(
  maketaId: number,
  productId: number,
  userId: number
): Promise<TransferMaketyFilesResult> {
  const result: TransferMaketyFilesResult = {
    softproofAttached: false,
    printDataAttached: false,
    hadSoftproofOnMaketa: false,
    hadPrintDataOnMaketa: false,
    filesIncomplete: false,
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
  result.hadSoftproofOnMaketa = softproof != null;
  result.hadPrintDataOnMaketa = printData != null;

  if (softproof) {
    const buffer = await readMaketyFileBuffer(softproof);
    if (!buffer) {
      result.warnings.push("Softproof: soubor na disku nenalezen.");
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
          `Softproof: ${e instanceof Error ? e.message : "Chyba při nahrání"}.`
        );
      }
    }
  }

  if (printData) {
    const buffer = await readMaketyFileBuffer(printData);
    if (!buffer) {
      result.warnings.push("Tisková data: soubor na disku nenalezen.");
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
          `Tisková data: ${e instanceof Error ? e.message : "Chyba při nahrání"}.`
        );
      }
    }
  }

  if (!softproof && !printData) {
    result.warnings.push("U zakázky není softproof ani tisková data.");
  }

  result.filesIncomplete = isMaketyImlFilesIncomplete(result);
  return result;
}
