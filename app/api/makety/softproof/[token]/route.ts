import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/db";
import {
  MAKETY_FILE_MODULE,
  maketyFileContentDisposition,
  resolveMaketyFileDiskPath,
  sanitizeMaketyMimeType,
} from "@/lib/makety-files";
import { verifySoftproofToken } from "@/lib/makety-softproof-token";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const raw = decodeURIComponent((await params).token);
    const payload = await verifySoftproofToken(raw);
    if (!payload) {
      return new NextResponse("Neplatný nebo vypršelý odkaz", { status: 401 });
    }

    const maketa = await prisma.makety.findFirst({
      where: { id: payload.maketaId, work_type: "grafika" },
      select: { id: true },
    });
    if (!maketa) {
      return new NextResponse("Zakázka nenalezena", { status: 404 });
    }

    const fileRow = await prisma.file_uploads.findFirst({
      where: {
        id: payload.fileId,
        module: MAKETY_FILE_MODULE,
        record_id: payload.maketaId,
      },
    });
    if (!fileRow) {
      return new NextResponse("Soubor nenalezen", { status: 404 });
    }

    const diskPath = resolveMaketyFileDiskPath(fileRow.file_path);
    if (!diskPath) {
      return new NextResponse("Neplatná cesta k souboru", { status: 500 });
    }

    let buf: Buffer;
    try {
      buf = await readFile(diskPath);
    } catch {
      return new NextResponse("Soubor na serveru chybí", { status: 404 });
    }

    await prisma.file_uploads.update({
      where: { id: fileRow.id },
      data: { last_accessed_at: new Date() },
    });

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": sanitizeMaketyMimeType(fileRow.mime_type),
        "Content-Disposition": maketyFileContentDisposition(fileRow.original_filename),
        "Content-Length": String(buf.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("GET /api/makety/softproof/[token]", e);
    return new NextResponse("Chyba při stažení", { status: 500 });
  }
}
