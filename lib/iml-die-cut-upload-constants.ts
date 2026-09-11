/** Konstanty a validace CAD příloh výseků (bez Node/Prisma — vhodné i pro client). */

export const IML_DIE_CUT_UPLOAD_MODULE = "iml_die_cuts";
export const IML_DIE_CUT_DOC_TYPE = "cad";
export const IML_DIE_CUT_MAX_FILES = 2;
export const IML_DIE_CUT_MAX_BYTES = 20 * 1024 * 1024;
export const IML_DIE_CUT_MAX_MB = IML_DIE_CUT_MAX_BYTES / (1024 * 1024);

export const IML_DIE_CUT_ALLOWED_EXTENSIONS = new Set([".pdf", ".dxf", ".dwg"]);

/** MIME, které prohlížeče běžně posílají; DXF/DWG často jako octet-stream. */
export const IML_DIE_CUT_ALLOWED_MIME = new Set([
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
]);

export function dieCutFileExtension(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  if (i < 0) return "";
  return fileName.slice(i).trim().toLowerCase();
}

/** Validace PDF/DXF/DWG — přípona je rozhodující; MIME jen doplňková kontrola. */
export function isAllowedDieCutCadFile(
  fileName: string,
  mime: string | null | undefined
): boolean {
  const ext = dieCutFileExtension(fileName);
  if (!IML_DIE_CUT_ALLOWED_EXTENSIONS.has(ext)) return false;
  const m = String(mime ?? "")
    .trim()
    .toLowerCase();
  if (!m || m === "application/octet-stream") return true;
  if (ext === ".pdf") return m === "application/pdf" || IML_DIE_CUT_ALLOWED_MIME.has(m);
  return IML_DIE_CUT_ALLOWED_MIME.has(m);
}

export function mimeForDieCutCadFile(fileName: string, mime: string | null | undefined): string {
  const ext = dieCutFileExtension(fileName);
  const m = String(mime ?? "").trim();
  if (m && m !== "application/octet-stream") return m.slice(0, 100);
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".dxf") return "application/dxf";
  if (ext === ".dwg") return "application/dwg";
  return "application/octet-stream";
}
