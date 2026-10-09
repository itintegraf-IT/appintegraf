import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { pdfBufferToJpeg } from "@/lib/iml-product-preview-pdf-server";
import {
  TECHNOLOGIE_DOC_PDF,
  TECHNOLOGIE_DOC_THUMBNAIL,
  TECHNOLOGIE_MODULE,
  TECHNOLOGIE_THUMB_JPEG_QUALITY,
  TECHNOLOGIE_THUMB_MAX_SIDE,
} from "./constants";

export function technologieUploadDir(): string {
  return path.join(process.cwd(), "public", "uploads", "technologie");
}

async function unlinkUploadFile(filePath: string): Promise<void> {
  if (!filePath.startsWith("/uploads/")) return;
  const diskPath = path.join(process.cwd(), "public", filePath.replace(/^\//, ""));
  try {
    await unlink(diskPath);
  } catch {
    // ignore
  }
}

/** Odstraní všechny soubory modulu u záznamu (disk + DB). */
export async function deleteAllTechnologieFiles(recordId: number): Promise<void> {
  const rows = await prisma.file_uploads.findMany({
    where: { module: TECHNOLOGIE_MODULE, record_id: recordId },
    select: { id: true, file_path: true },
  });
  for (const row of rows) {
    await unlinkUploadFile(row.file_path);
    await prisma.file_uploads.delete({ where: { id: row.id } });
  }
}

/** Odstraní PDF a thumbnail u záznamu. */
export async function deleteTechnologiePdfAndThumbnail(recordId: number): Promise<void> {
  const rows = await prisma.file_uploads.findMany({
    where: {
      module: TECHNOLOGIE_MODULE,
      record_id: recordId,
      document_type: { in: [TECHNOLOGIE_DOC_PDF, TECHNOLOGIE_DOC_THUMBNAIL] },
    },
    select: { id: true, file_path: true },
  });
  for (const row of rows) {
    await unlinkUploadFile(row.file_path);
    await prisma.file_uploads.delete({ where: { id: row.id } });
  }
}

export async function saveTechnologiePdfUpload(
  recordId: number,
  userId: number,
  originalName: string,
  pdfBuffer: Buffer
): Promise<{ pdfId: number; thumbnailCreated: boolean }> {
  await deleteTechnologiePdfAndThumbnail(recordId);

  const uploadDir = technologieUploadDir();
  await mkdir(uploadDir, { recursive: true });

  const pdfSafeName = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}.pdf`;
  const pdfWebPath = `/uploads/technologie/${pdfSafeName}`;
  await writeFile(path.join(uploadDir, pdfSafeName), pdfBuffer);

  const pdfRow = await prisma.file_uploads.create({
    data: {
      filename: pdfSafeName,
      original_filename: originalName.slice(0, 250),
      file_path: pdfWebPath,
      file_size: pdfBuffer.length,
      mime_type: "application/pdf",
      module: TECHNOLOGIE_MODULE,
      record_id: recordId,
      document_type: TECHNOLOGIE_DOC_PDF,
      uploaded_by: userId,
      is_public: false,
    },
  });

  let thumbnailCreated = false;
  const jpeg = await pdfBufferToJpeg(pdfBuffer, {
    maxSide: TECHNOLOGIE_THUMB_MAX_SIDE,
    jpegQuality: TECHNOLOGIE_THUMB_JPEG_QUALITY,
  });

  if (jpeg) {
    const thumbSafeName = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}.jpg`;
    const thumbWebPath = `/uploads/technologie/${thumbSafeName}`;
    await writeFile(path.join(uploadDir, thumbSafeName), jpeg);

    await prisma.file_uploads.create({
      data: {
        filename: thumbSafeName,
        original_filename: "nahled.jpg",
        file_path: thumbWebPath,
        file_size: jpeg.length,
        mime_type: "image/jpeg",
        module: TECHNOLOGIE_MODULE,
        record_id: recordId,
        document_type: TECHNOLOGIE_DOC_THUMBNAIL,
        uploaded_by: userId,
        is_public: false,
      },
    });
    thumbnailCreated = true;
    await prisma.technologie.update({
      where: { id: recordId },
      data: { preview_updated_at: new Date(), updated_at: new Date() },
    });
  } else {
    await prisma.technologie.update({
      where: { id: recordId },
      data: { preview_updated_at: null, updated_at: new Date() },
    });
    console.warn("technologie: thumbnail generation failed for record", recordId);
  }

  return { pdfId: pdfRow.id, thumbnailCreated };
}
