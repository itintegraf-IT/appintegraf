import path from "path";
import {
  MAX_PRODUCT_PDF_BYTES,
  MAX_PRODUCT_PDF_MB,
} from "@/lib/iml-product-upload-limits";

export const MAKETY_FILE_MODULE = "makety";

/** Absolutní cesta k souboru v `public/uploads/…`. */
export function resolveMaketyFileDiskPath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.startsWith("/uploads/")) {
    return path.join(process.cwd(), "public", normalized.slice(1));
  }
  if (normalized.startsWith("uploads/")) {
    return path.join(process.cwd(), "public", normalized);
  }
  if (path.isAbsolute(filePath)) return filePath;
  return null;
}

export type MaketyFileDisposition = "inline" | "attachment";

/** HTTP hlavička Content-Disposition – pouze ASCII v filename=, UTF-8 v filename*. */
export function maketyFileContentDisposition(
  originalName: string,
  mode: MaketyFileDisposition = "inline"
): string {
  const name = (originalName || "soubor").replace(/[\r\n"]/g, "_").trim() || "soubor";
  const ascii = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .slice(0, 150) || "soubor";
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export function sanitizeMaketyMimeType(mime: string | null | undefined): string {
  const raw = (mime || "application/octet-stream").split(";")[0].trim();
  return /^[\w.+-]+\/[\w.+-]+$/.test(raw) ? raw : "application/octet-stream";
}

/** Stejný strop jako IML tisková data (PDF). */
export const MAKETY_MAX_BYTES = MAX_PRODUCT_PDF_BYTES;
export const MAKETY_MAX_MB = MAX_PRODUCT_PDF_MB;

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
