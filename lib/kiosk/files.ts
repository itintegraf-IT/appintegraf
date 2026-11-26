import path from "path";
import { readFile, stat } from "fs/promises";
import { NextResponse } from "next/server";

/** Absolutní cesta na disku z webové cesty `/uploads/kiosk/...`. */
export function resolveKioskDiskPath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, "/").trim();
  if (!normalized.startsWith("/uploads/kiosk/")) return null;
  const name = normalized.slice("/uploads/kiosk/".length);
  if (!name || name.includes("..") || name.includes("/")) return null;
  return path.join(process.cwd(), "public", "uploads", "kiosk", name);
}

export function kioskMimeFromSlide(
  fileType: string,
  filePath: string
): string {
  const ext = path.extname(filePath).toLowerCase();
  if (fileType === "pdf" || ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  return "image/jpeg";
}

/** Ověří, že soubor na disku existuje a má nenulovou velikost. */
export async function verifyKioskFileOnDisk(diskPath: string): Promise<boolean> {
  try {
    const s = await stat(diskPath);
    return s.isFile() && s.size > 0;
  } catch {
    return false;
  }
}

export async function serveKioskSlideFile(params: {
  file_path: string;
  file_type: string;
  filename: string;
}): Promise<NextResponse> {
  const diskPath = resolveKioskDiskPath(params.file_path);
  if (!diskPath) {
    return NextResponse.json({ error: "Neplatná cesta souboru" }, { status: 400 });
  }

  let buf: Buffer;
  try {
    buf = await readFile(diskPath);
  } catch {
    return NextResponse.json({ error: "Soubor na serveru chybí." }, { status: 404 });
  }

  if (buf.length === 0) {
    return NextResponse.json({ error: "Soubor na serveru chybí." }, { status: 404 });
  }

  const mime = kioskMimeFromSlide(params.file_type, params.file_path);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buf.length),
      "Cache-Control": "private, max-age=60",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(params.filename)}`,
    },
  });
}

export function adminKioskSlideFileUrl(slideId: number): string {
  return `/api/kiosk/slides/${slideId}/file`;
}

export function publicKioskSlideFileUrl(token: string, slideId: number): string {
  return `/api/public/kiosk/${encodeURIComponent(token)}/file/${slideId}`;
}
