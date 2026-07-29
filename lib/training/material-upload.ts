import { unlink } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { MaterialType } from "@/lib/training/material-types";

export const TRAINING_MATERIAL_UPLOAD_MODULE = "training_materials";

export const TRAINING_VIDEO_MAX_BYTES = 500 * 1024 * 1024;
export const TRAINING_PRESENTATION_MAX_BYTES = 50 * 1024 * 1024;

export const TRAINING_VIDEO_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/x-msvideo",
  "video/mpeg",
  "video/ogg",
  "video/3gpp",
]);
export const TRAINING_PRESENTATION_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const EXTENSION_MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".ogv": "video/ogg",
  ".3gp": "video/3gpp",
  ".pdf": "application/pdf",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export const TRAINING_MATERIAL_UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "training-materials"
);

export function trainingMaterialUploadWebPath(safeName: string): string {
  return `/uploads/training-materials/${safeName}`;
}

export function trainingMaterialUploadDiskPath(safeName: string): string {
  return path.join(TRAINING_MATERIAL_UPLOAD_DIR, safeName);
}

export function diskPathFromWebPath(webPath: string): string {
  const normalized = webPath.replace(/^\//, "");
  return path.join(process.cwd(), "public", normalized);
}

/** Odhad MIME z přípony, pokud prohlížeč nepošle typ (běžné u Windows). */
export function inferUploadMime(fileName: string, reportedMime: string): string {
  const reported = reportedMime.trim();
  if (reported && reported !== "application/octet-stream") {
    return reported;
  }
  const ext = path.extname(fileName).toLowerCase();
  return EXTENSION_MIME[ext] ?? (reported || "application/octet-stream");
}

export function isAllowedUploadMime(materialType: MaterialType, mime: string, fileName: string): boolean {
  const resolved = inferUploadMime(fileName, mime);
  return allowedMimeForMaterialType(materialType).has(resolved);
}

export function contentDisposition(filename: string, inline: boolean): string {
  const safe = filename.replace(/[^\w.\- ()ěščřžýáíéúůďťňĚŠČŘŽÝÁÍÉÚŮĎŤŇ]+/gi, "_");
  const type = inline ? "inline" : "attachment";
  return `${type}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function maxBytesForMaterialType(type: MaterialType): number {
  return type === "video" ? TRAINING_VIDEO_MAX_BYTES : TRAINING_PRESENTATION_MAX_BYTES;
}

export function allowedMimeForMaterialType(type: MaterialType): Set<string> {
  return type === "video" ? TRAINING_VIDEO_MIME : TRAINING_PRESENTATION_MIME;
}

export function documentTypeForMaterialType(type: MaterialType): "video" | "presentation" {
  return type === "video" ? "video" : "presentation";
}

/** Smaže všechny soubory materiálu z DB i disku. */
export async function deleteMaterialUploads(
  materialId: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  const rows = await db.file_uploads.findMany({
    where: { module: TRAINING_MATERIAL_UPLOAD_MODULE, record_id: materialId },
    select: { id: true, file_path: true },
  });

  for (const row of rows) {
    try {
      await unlink(diskPathFromWebPath(row.file_path));
    } catch {
      // soubor už chybí na disku
    }
  }

  await db.file_uploads.deleteMany({
    where: { module: TRAINING_MATERIAL_UPLOAD_MODULE, record_id: materialId },
  });
}
