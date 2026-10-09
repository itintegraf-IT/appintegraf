export const TECHNOLOGIE_MODULE = "technologie" as const;

export const TECHNOLOGIE_MAX_BYTES = 50 * 1024 * 1024;

export const TECHNOLOGIE_DOC_PDF = "pdf" as const;
export const TECHNOLOGIE_DOC_THUMBNAIL = "thumbnail" as const;

export const TECHNOLOGIE_ALLOWED_EXTENSIONS = new Set([".pdf"]);

export const TECHNOLOGIE_THUMB_MAX_SIDE = 256;
export const TECHNOLOGIE_THUMB_JPEG_QUALITY = 0.82;

export function getFileExtension(filename: string): string {
  const i = filename.lastIndexOf(".");
  if (i < 0) return "";
  return filename.slice(i).toLowerCase();
}

export function mimeTypeForTechnologieFilename(
  filename: string,
  storedMime?: string | null
): string {
  const ext = getFileExtension(filename);
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  const stored = (storedMime ?? "").trim();
  if (stored && stored !== "application/octet-stream") return stored;
  return "application/octet-stream";
}
