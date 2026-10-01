import path from "path";

/** Typy, které prohlížeč smí zobrazit přímo; ostatní se jen stahují. */
const INLINE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);
/** Typy, které smí odejít s vlastním Content-Type (odpovídají ověřeným uploadům). */
const SERVABLE_MIME = new Set([
  ...INLINE_MIME,
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/**
 * Cesta na disku k fotce/příloze položky. Jen soubor přímo ve složce
 * `/uploads/equipment/<itemId>/`, jinak `null` (cizí položka, `..`, podsložky).
 */
export function equipmentFileDiskPath(itemId: number, filePath: string): string | null {
  const match = /^\/uploads\/equipment\/(\d+)\/([^/\\]+)$/.exec(filePath);
  if (!match || Number(match[1]) !== itemId) return null;
  const name = match[2];
  if (name === "." || name === "..") return null;
  return path.join(process.cwd(), "public", "uploads", "equipment", String(itemId), name);
}

/** Přípony, které server při nahrání sám určil podle obsahu (lib/equipment/upload-verify.ts). */
const SERVED_EXTENSIONS = new Set([".jpg", ".png", ".webp", ".gif", ".pdf", ".docx", ".doc"]);

/**
 * Název pro stažení: původní název bez přípony + přípona ověřená serverem.
 * Soubor tak nikdy nepřijde s příponou, kterou zvolil ten, kdo ho nahrál (např. .hta, .exe).
 */
export function equipmentDownloadName(originalName: string, filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const name = (originalName || "").trim();
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name).trim() || "soubor";
  return base + (SERVED_EXTENSIONS.has(ext) ? ext : ".bin");
}

/** Content-Disposition: v `filename=` jen ASCII, celý název v UTF-8 ve `filename*=` (RFC 5987). */
export function equipmentFileContentDisposition(name: string, mode: "inline" | "attachment"): string {
  const clean = (name || "").replace(/[\r\n"]/g, "_").trim() || "soubor";
  const ascii =
    clean
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._ -]/g, "_")
      .slice(0, 150) || "soubor";
  const encoded = encodeURIComponent(clean).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function equipmentServeHeaders(
  mime: string | null,
  originalName: string,
  download: boolean
): Record<string, string> {
  const type = (mime ?? "").split(";")[0].trim().toLowerCase();
  const servable = SERVABLE_MIME.has(type);
  const inline = !download && INLINE_MIME.has(type);
  return {
    "Content-Type": servable ? type : "application/octet-stream",
    "Content-Disposition": equipmentFileContentDisposition(originalName, inline ? "inline" : "attachment"),
    "X-Content-Type-Options": "nosniff",
    // Obsah pod daným ID se nemění (nový upload = nové ID) → fotky lze cachovat.
    "Cache-Control": type.startsWith("image/") && servable ? "private, max-age=86400, immutable" : "private, no-store",
  };
}
