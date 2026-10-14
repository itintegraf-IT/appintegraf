import { unlink } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  IML_SHAPE_UPLOAD_MODULE,
  IML_TOOL_UPLOAD_MODULE,
} from "@/lib/iml-catalog-attachment-constants";

export {
  IML_SHAPE_UPLOAD_MODULE,
  IML_TOOL_UPLOAD_MODULE,
  IML_CATALOG_ATTACHMENT_DOC_TYPE,
  IML_CATALOG_ATTACHMENT_MAX_FILES,
  IML_CATALOG_ATTACHMENT_MAX_BYTES,
  IML_CATALOG_ATTACHMENT_MAX_MB,
  IML_CATALOG_ATTACHMENT_EXTENSIONS,
  catalogAttachmentExtension,
  isAllowedCatalogAttachment,
  mimeForCatalogAttachment,
  isInlinePreviewableMime,
} from "@/lib/iml-catalog-attachment-constants";

export type CatalogAttachmentKind = "shape" | "tool";

export function catalogUploadModule(kind: CatalogAttachmentKind): string {
  return kind === "shape" ? IML_SHAPE_UPLOAD_MODULE : IML_TOOL_UPLOAD_MODULE;
}

export function catalogUploadDir(kind: CatalogAttachmentKind): string {
  return path.join(
    process.cwd(),
    "public",
    "uploads",
    kind === "shape" ? "iml-shapes" : "iml-tools"
  );
}

export function catalogUploadWebPath(kind: CatalogAttachmentKind, safeName: string): string {
  const folder = kind === "shape" ? "iml-shapes" : "iml-tools";
  return `/uploads/${folder}/${safeName}`;
}

export function catalogUploadDiskPath(kind: CatalogAttachmentKind, safeName: string): string {
  return path.join(catalogUploadDir(kind), safeName);
}

export function diskPathFromCatalogWebPath(webPath: string): string {
  const normalized = webPath.replace(/^\//, "");
  return path.join(process.cwd(), "public", normalized);
}

export async function deleteAllCatalogAttachments(
  kind: CatalogAttachmentKind,
  recordId: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  const module = catalogUploadModule(kind);
  const rows = await db.file_uploads.findMany({
    where: { module, record_id: recordId },
    select: { id: true, file_path: true },
  });

  for (const row of rows) {
    try {
      await unlink(diskPathFromCatalogWebPath(row.file_path));
    } catch {
      // soubor už chybí
    }
  }

  await db.file_uploads.deleteMany({
    where: { module, record_id: recordId },
  });
}
