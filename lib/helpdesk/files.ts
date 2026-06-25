import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { prisma } from "@/lib/db";
import { canManageHelpdesk } from "@/lib/helpdesk/access";
import type { helpdesk_status } from "@prisma/client";
import {
  HELPDESK_ALLOWED_FORMATS_LABEL,
  HELPDESK_COMMENT_FILE_MODULE,
  HELPDESK_FILE_MODULE,
  HELPDESK_MAX_BYTES,
  HELPDESK_MAX_FILES_PER_RECORD,
} from "@/lib/helpdesk/file-constants";

export {
  HELPDESK_ALLOWED_FORMATS_LABEL,
  HELPDESK_COMMENT_FILE_MODULE,
  HELPDESK_FILE_MODULE,
  HELPDESK_MAX_BYTES,
  HELPDESK_MAX_FILES_PER_RECORD,
};

export const HELPDESK_ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const HELPDESK_ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".txt",
  ".log",
  ".csv",
  ".zip",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
]);

export function isHelpdeskUploadAllowed(file: { name: string; type: string }): boolean {
  const ext = path.extname(file.name).toLowerCase();
  if (HELPDESK_ALLOWED_EXTENSIONS.has(ext)) return true;
  const mime = (file.type || "").toLowerCase();
  if (mime && HELPDESK_ALLOWED_MIME.has(mime)) return true;
  if (mime === "application/octet-stream" && [".log", ".txt", ".zip"].includes(ext)) {
    return true;
  }
  return false;
}

export function canModifyTicketAttachments(ticket: { status: helpdesk_status }): boolean {
  return ticket.status !== "uzavreno";
}

export async function canViewTicket(
  userId: number,
  ticket: { requester_id: number }
): Promise<boolean> {
  if (ticket.requester_id === userId) return true;
  return canManageHelpdesk(userId);
}

export async function canUploadToTicket(
  userId: number,
  ticket: { requester_id: number; status: helpdesk_status }
): Promise<boolean> {
  if (!canModifyTicketAttachments(ticket)) return false;
  if (ticket.requester_id === userId) return true;
  return canManageHelpdesk(userId);
}

export async function canDeleteFile(
  userId: number,
  ticket: { requester_id: number; status: helpdesk_status },
  uploadedBy: number
): Promise<boolean> {
  if (!canModifyTicketAttachments(ticket)) return false;
  if (uploadedBy === userId) return true;
  return canManageHelpdesk(userId);
}

export function helpdeskUploadWebPath(safeName: string): string {
  return `/uploads/helpdesk/${safeName}`;
}

export function resolveHelpdeskFileDiskPath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.startsWith("/uploads/helpdesk/")) {
    return path.join(process.cwd(), "public", normalized.slice(1));
  }
  if (normalized.startsWith("uploads/helpdesk/")) {
    return path.join(process.cwd(), "public", normalized);
  }
  return null;
}

export async function countHelpdeskFiles(module: string, recordId: number): Promise<number> {
  return prisma.file_uploads.count({
    where: { module, record_id: recordId },
  });
}

export async function saveHelpdeskFile(params: {
  file: File;
  module: string;
  recordId: number;
  userId: number;
}): Promise<
  | { ok: true; row: Awaited<ReturnType<typeof prisma.file_uploads.create>> }
  | { ok: false; error: string }
> {
  const { file, module, recordId, userId } = params;

  if (!isHelpdeskUploadAllowed({ name: file.name, type: file.type || "" })) {
    return {
      ok: false,
      error: `Soubor „${file.name}“: nepovolený typ (${HELPDESK_ALLOWED_FORMATS_LABEL})`,
    };
  }
  if (file.size > HELPDESK_MAX_BYTES) {
    return { ok: false, error: `Soubor „${file.name}“ je větší než 20 MB` };
  }

  const existing = await countHelpdeskFiles(module, recordId);
  if (existing >= HELPDESK_MAX_FILES_PER_RECORD) {
    return { ok: false, error: `Maximálně ${HELPDESK_MAX_FILES_PER_RECORD} příloh` };
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "helpdesk");
  await mkdir(uploadDir, { recursive: true });

  const ext = path.extname(file.name) || ".bin";
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${ext}`;
  const diskPath = path.join(uploadDir, safeName);
  const webPath = helpdeskUploadWebPath(safeName);

  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(diskPath, buf);

  const mime = file.type || "application/octet-stream";
  const row = await prisma.file_uploads.create({
    data: {
      filename: safeName,
      original_filename: file.name.slice(0, 250),
      file_path: webPath,
      file_size: buf.length,
      mime_type: mime.slice(0, 100),
      module,
      record_id: recordId,
      uploaded_by: userId,
      is_public: false,
    },
    include: {
      users: { select: { first_name: true, last_name: true } },
    },
  });

  return { ok: true, row };
}
