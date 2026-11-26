import path from "path";
import { randomUUID } from "crypto";

export const KIOSK_ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/jpg",
  "application/pdf",
] as const;

export const KIOSK_MAX_SIZE = 25 * 1024 * 1024; // 25 MB (TV JPG často ~13 MB)

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
};

/** Odvodí MIME z file.type nebo přípony (prázdný type na Windows). */
export function resolveKioskMime(file: File): string | null {
  const raw = (file.type || "").toLowerCase().trim();
  if (KIOSK_ALLOWED_MIMES.includes(raw as (typeof KIOSK_ALLOWED_MIMES)[number])) {
    return raw === "image/jpg" ? "image/jpeg" : raw;
  }
  const ext = path.extname(file.name).toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

export function kioskFileTypeFromMime(mime: string): "pdf" | "image" {
  return mime === "application/pdf" ? "pdf" : "image";
}

export function extensionForKioskMime(mime: string, originalName: string): string {
  const fromName = path.extname(originalName);
  if (fromName) return fromName;
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/png") return ".png";
  return ".jpg";
}

export type KioskFileRejectReason = "type" | "size";

export function validateKioskFile(
  file: File
): { ok: true; mime: string } | { ok: false; reason: KioskFileRejectReason } {
  const mime = resolveKioskMime(file);
  if (!mime) return { ok: false, reason: "type" };
  if (file.size > KIOSK_MAX_SIZE) return { ok: false, reason: "size" };
  return { ok: true, mime };
}

export function newKioskPublicToken(): string {
  return randomUUID();
}

export function kioskUploadRejectMessage(reasons: KioskFileRejectReason[]): string {
  const hasType = reasons.includes("type");
  const hasSize = reasons.includes("size");
  if (hasType && hasSize) {
    return "Nepodařilo se nahrát soubory (povolené: JPG, PNG, PDF; max 25 MB)";
  }
  if (hasSize) return "Soubor je větší než 25 MB";
  return "Nepodporovaný typ souboru (povolené: JPG, PNG, PDF)";
}
