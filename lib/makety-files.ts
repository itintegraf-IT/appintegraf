import path from "path";

export const MAKETY_FILE_MODULE = "makety";

export const MAKETY_MAX_BYTES = 20 * 1024 * 1024;

export const MAKETY_MAX_FILES_PER_REQUEST = 20;

/** Povolené MIME typy (kromě kontroly přípony). */
export const MAKETY_ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "message/rfc822",
  "application/vnd.ms-outlook",
  "text/plain",
  "multipart/related",
]);

/** Povolené přípony – platí i když prohlížeč pošle application/octet-stream. */
export const MAKETY_ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".eml",
  ".msg",
  ".mht",
  ".mhtml",
]);

export const MAKETY_ALLOWED_FORMATS_LABEL =
  "PDF, Word, Excel, obrázky (JPG/PNG), e-mail (.eml, .msg)";

export function isMaketyUploadAllowed(file: { name: string; type: string }): boolean {
  const ext = path.extname(file.name).toLowerCase();
  if (MAKETY_ALLOWED_EXTENSIONS.has(ext)) return true;
  const mime = (file.type || "").toLowerCase();
  if (mime && MAKETY_ALLOWED_MIME.has(mime)) return true;
  if (mime === "application/octet-stream" && [".eml", ".msg", ".mht", ".mhtml"].includes(ext)) {
    return true;
  }
  return false;
}
