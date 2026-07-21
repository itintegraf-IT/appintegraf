import { z } from "zod";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "message/rfc822",
  "application/vnd.ms-outlook",
]);

export const AttachmentMetaSchema = z.object({
  parentType: z.enum(["CARD"]),
  parentId: z.string().cuid(),
});

export type AttachmentMeta = z.infer<typeof AttachmentMetaSchema>;
