import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { userCanViewMaketa, userCanEditMaketa } from "@/lib/makety-access";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import {
  MAKETY_FILE_MODULE,
  maketyFileContentDisposition,
  resolveMaketyFileDiskPath,
  sanitizeMaketyMimeType,
} from "@/lib/makety-files";
import { readFile, unlink } from "fs/promises";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Neautorizováno", { status: 401 });
    }
    const userId = parseInt(session.user.id, 10);
    if (!(await canAccessMaketyModule(userId))) {
      return new NextResponse("Nemáte oprávnění", { status: 403 });
    }

    const maketaId = parseInt((await params).id, 10);
    const fileId = parseInt((await params).fileId, 10);
    if (Number.isNaN(maketaId) || Number.isNaN(fileId)) {
      return new NextResponse("Neplatné ID", { status: 400 });
    }

    if (!(await userCanViewMaketa(userId, maketaId))) {
      return new NextResponse("Maketa nenalezena", { status: 404 });
    }

    const fileRow = await prisma.file_uploads.findFirst({
      where: { id: fileId, module: MAKETY_FILE_MODULE, record_id: maketaId },
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
      return new NextResponse(
        "Soubor na serveru chybí. Pokud byl nahrán na jiném prostředí, nahrajte ho znovu.",
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": sanitizeMaketyMimeType(fileRow.mime_type),
        "Content-Disposition": maketyFileContentDisposition(fileRow.original_filename),
        "Content-Length": String(buf.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("GET /api/makety/[id]/files/[fileId]", e);
    return new NextResponse("Chyba při načítání souboru", { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const maketaId = parseInt((await params).id, 10);
  const fileId = parseInt((await params).fileId, 10);
  if (Number.isNaN(maketaId) || Number.isNaN(fileId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanViewMaketa(userId, maketaId))) {
    return NextResponse.json({ error: "Maketa nenalezena" }, { status: 404 });
  }

  const canDelete = await userCanEditMaketa(userId, maketaId);
  if (!canDelete) {
    return NextResponse.json({ error: "Smazat soubor může jen zadavatel" }, { status: 403 });
  }

  const fileRow = await prisma.file_uploads.findFirst({
    where: { id: fileId, module: MAKETY_FILE_MODULE, record_id: maketaId },
  });
  if (!fileRow) {
    return NextResponse.json({ error: "Soubor nenalezen" }, { status: 404 });
  }

  const diskPath = resolveMaketyFileDiskPath(fileRow.file_path);
  if (!diskPath) {
    return NextResponse.json({ error: "Neplatná cesta k souboru" }, { status: 500 });
  }
  try {
    await unlink(diskPath);
  } catch {
    /* soubor na disku už nemusí existovat */
  }

  await prisma.file_uploads.delete({ where: { id: fileId } });
  return NextResponse.json({ success: true });
}
