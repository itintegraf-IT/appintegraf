/**
 * Ověření nahraného souboru podle obsahu (signatury bajtů), ne podle přípony
 * nebo typu, který pošle prohlížeč. Příponu a MIME pak určuje server.
 *
 * Jen pro server (API routy). Nepoužívá knihovnu `file-type` — ta vyžaduje
 * Node ≥ 22, server běží na Node 20.
 */

export type EquipmentUploadKind = "photo" | "attachment" | "floor_plan";

export type SniffedFileType = { mime: string; ext: string };

export type EquipmentUploadCheck =
  | { ok: true; mime: string; ext: string }
  | { ok: false; error: string };

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
/** Kontejner CFB = starý Word, Excel i PowerPoint; obsah sám typ neurčí. */
const CFB_MIME = "application/x-cfb";

const ALLOWED: Record<EquipmentUploadKind, { mimes: string[]; label: string }> = {
  photo: {
    mimes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    label: "JPG, PNG, WebP, GIF",
  },
  attachment: {
    mimes: ["image/jpeg", "image/png", "image/webp", "application/pdf", DOCX_MIME, "application/msword"],
    label: "JPG, PNG, WebP, PDF, Word",
  },
  floor_plan: {
    mimes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    label: "JPG, PNG, WebP, PDF",
  },
};

function hasBytes(buf: Uint8Array, expected: number[], offset = 0): boolean {
  if (buf.length < offset + expected.length) return false;
  return expected.every((b, i) => buf[offset + i] === b);
}

function hasAscii(buf: Uint8Array, text: string, offset = 0): boolean {
  return hasBytes(buf, Array.from(text, (c) => c.charCodeAt(0)), offset);
}

function asBuffer(buf: Uint8Array): Buffer {
  return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
}

/** PDF: hlavička na začátku, před ní smí být jen BOM nebo prázdné znaky. */
function startsWithPdfHeader(buf: Uint8Array): boolean {
  let i = hasBytes(buf, [0xef, 0xbb, 0xbf]) ? 3 : 0;
  while (i < buf.length && i < 1024 && [0x09, 0x0a, 0x0c, 0x0d, 0x20].includes(buf[i])) i++;
  return hasAscii(buf, "%PDF-", i);
}

/** ZIP obsahuje položku s přesně tímto názvem (podle lokálních hlaviček souborů). */
function zipHasEntry(buf: Uint8Array, entryName: string): boolean {
  const b = asBuffer(buf);
  const signature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const name = Buffer.from(entryName, "latin1");
  for (let i = b.indexOf(signature); i !== -1 && i + 30 <= b.length; i = b.indexOf(signature, i + 4)) {
    const nameLength = b.readUInt16LE(i + 26);
    if (nameLength === name.length && b.subarray(i + 30, i + 30 + nameLength).equals(name)) return true;
  }
  return false;
}

export function sniffEquipmentFileType(buf: Uint8Array): SniffedFileType | null {
  if (hasBytes(buf, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: ".jpg" };
  if (hasBytes(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", ext: ".png" };
  }
  if (hasAscii(buf, "GIF87a") || hasAscii(buf, "GIF89a")) return { mime: "image/gif", ext: ".gif" };
  if (hasAscii(buf, "RIFF") && hasAscii(buf, "WEBP", 8)) return { mime: "image/webp", ext: ".webp" };
  if (startsWithPdfHeader(buf)) return { mime: "application/pdf", ext: ".pdf" };
  if (hasBytes(buf, [0x50, 0x4b, 0x03, 0x04]) && zipHasEntry(buf, "word/document.xml")) {
    return { mime: DOCX_MIME, ext: ".docx" };
  }
  if (hasBytes(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return { mime: CFB_MIME, ext: ".doc" };
  }
  return null;
}

export function verifyEquipmentUpload(
  buf: Uint8Array,
  declaredMime: string,
  kind: EquipmentUploadKind
): EquipmentUploadCheck {
  const allowed = ALLOWED[kind];
  const rejected: EquipmentUploadCheck = {
    ok: false,
    error: `Nepodporovaný typ souboru. Povolené: ${allowed.label}.`,
  };

  const sniffed = sniffEquipmentFileType(buf);
  if (!sniffed) return rejected;

  if (sniffed.mime === CFB_MIME) {
    const isWord = declaredMime === "application/msword";
    return isWord && allowed.mimes.includes("application/msword")
      ? { ok: true, mime: "application/msword", ext: ".doc" }
      : rejected;
  }

  return allowed.mimes.includes(sniffed.mime) ? { ok: true, ...sniffed } : rejected;
}
