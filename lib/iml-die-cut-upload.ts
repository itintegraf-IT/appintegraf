import { unlink } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { IML_DIE_CUT_UPLOAD_MODULE } from "@/lib/iml-die-cut-upload-constants";

export {
  IML_DIE_CUT_UPLOAD_MODULE,
  IML_DIE_CUT_DOC_TYPE,
  IML_DIE_CUT_MAX_FILES,
  IML_DIE_CUT_MAX_BYTES,
  IML_DIE_CUT_MAX_MB,
  IML_DIE_CUT_ALLOWED_EXTENSIONS,
  IML_DIE_CUT_ALLOWED_MIME,
  dieCutFileExtension,
  isAllowedDieCutCadFile,
  mimeForDieCutCadFile,
} from "@/lib/iml-die-cut-upload-constants";

export const IML_DIE_CUT_UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "iml-die-cuts"
);

export function imlDieCutUploadWebPath(safeName: string): string {
  return `/uploads/iml-die-cuts/${safeName}`;
}

export function imlDieCutUploadDiskPath(safeName: string): string {
  return path.join(IML_DIE_CUT_UPLOAD_DIR, safeName);
}

export function diskPathFromDieCutWebPath(webPath: string): string {
  const normalized = webPath.replace(/^\//, "");
  return path.join(process.cwd(), "public", normalized);
}

/** Smaže všechny CAD přílohy výseku z DB i disku. */
export async function deleteAllDieCutUploads(
  dieCutId: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  const rows = await db.file_uploads.findMany({
    where: { module: IML_DIE_CUT_UPLOAD_MODULE, record_id: dieCutId },
    select: { id: true, file_path: true },
  });

  for (const row of rows) {
    try {
      await unlink(diskPathFromDieCutWebPath(row.file_path));
    } catch {
      // soubor už chybí na disku
    }
  }

  await db.file_uploads.deleteMany({
    where: { module: IML_DIE_CUT_UPLOAD_MODULE, record_id: dieCutId },
  });
}
