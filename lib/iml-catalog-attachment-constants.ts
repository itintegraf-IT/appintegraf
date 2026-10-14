/** Konstanty příloh tvarů / nástrojů (bez Node — vhodné i pro client). */

export const IML_SHAPE_UPLOAD_MODULE = "iml_shapes";
export const IML_TOOL_UPLOAD_MODULE = "iml_tools";
export const IML_CATALOG_ATTACHMENT_DOC_TYPE = "drawing";
export const IML_CATALOG_ATTACHMENT_MAX_FILES = 10;
export const IML_CATALOG_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
export const IML_CATALOG_ATTACHMENT_MAX_MB =
  IML_CATALOG_ATTACHMENT_MAX_BYTES / (1024 * 1024);

export const IML_CATALOG_ATTACHMENT_EXTENSIONS = new Set([
  ".pdf",
  ".dxf",
  ".dwg",
  ".cad",
  ".jpg",
  ".jpeg",
  ".png",
]);

export const IML_CATALOG_ATTACHMENT_MIME = new Set([
  "application/pdf",
  "application/dxf",
  "image/vnd.dxf",
  "application/x-dxf",
  "drawing/x-dxf",
  "application/acad",
  "application/x-acad",
  "application/autocad_dwg",
  "image/vnd.dwg",
  "application/dwg",
  "application/x-dwg",
  "application/octet-stream",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/cad",
]);

export function catalogAttachmentExtension(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  if (i < 0) return "";
  return fileName.slice(i).trim().toLowerCase();
}

export function isAllowedCatalogAttachment(
  fileName: string,
  mime: string | null | undefined
): boolean {
  const ext = catalogAttachmentExtension(fileName);
  if (!IML_CATALOG_ATTACHMENT_EXTENSIONS.has(ext)) return false;
  const m = String(mime ?? "")
    .trim()
    .toLowerCase();
  if (!m || m === "application/octet-stream") return true;
  if (ext === ".pdf") return m === "application/pdf" || IML_CATALOG_ATTACHMENT_MIME.has(m);
  if (ext === ".jpg" || ext === ".jpeg") return m === "image/jpeg" || m === "image/jpg";
  if (ext === ".png") return m === "image/png";
  return IML_CATALOG_ATTACHMENT_MIME.has(m);
}

export function mimeForCatalogAttachment(
  fileName: string,
  mime: string | null | undefined
): string {
  const ext = catalogAttachmentExtension(fileName);
  const m = String(mime ?? "").trim();
  if (m && m !== "application/octet-stream") return m.slice(0, 100);
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".dxf") return "application/dxf";
  if (ext === ".dwg") return "application/dwg";
  if (ext === ".cad") return "application/octet-stream";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  return "application/octet-stream";
}

export function isInlinePreviewableMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return m.includes("pdf") || m.startsWith("image/");
}
