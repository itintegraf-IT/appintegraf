import { unlink } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { MaterialType } from "@/lib/training/material-types";

export const TRAINING_MATERIAL_UPLOAD_MODULE = "training_materials";

export const TRAINING_VIDEO_MAX_BYTES = 200 * 1024 * 1024;
export const TRAINING_PRESENTATION_MAX_BYTES = 50 * 1024 * 1024;

export const TRAINING_VIDEO_MIME = new Set(["video/mp4", "video/webm"]);
export const TRAINING_PRESENTATION_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

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
