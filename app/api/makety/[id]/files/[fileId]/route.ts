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
import { requireMaketyFileKind } from "@/lib/makety-file-kind";
import { recordMaketyFileEvent } from "@/lib/makety-file-events";
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

    await recordMaketyFileEvent({
      maketaId,
      fileId: fileRow.id,
      eventType: "downloaded",
      userId,
      meta: { filename: fileRow.original_filename, document_type: fileRow.document_type },
    });

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
    console.error("GET /api/makety/[id]/files/[fileId]", e);
    return new NextResponse("Chyba při načítání souboru", { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
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

  const canEdit =
    (await userCanEditMaketa(userId, maketaId)) || (await userCanViewMaketa(userId, maketaId));
  if (!canEdit) {
    return NextResponse.json({ error: "Nemáte oprávnění měnit typ souboru" }, { status: 403 });
  }

  let body: { document_type?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  const kindParsed = requireMaketyFileKind(body.document_type);
  if (!kindParsed.ok) {
    return NextResponse.json({ error: kindParsed.error }, { status: 400 });
  }

  const fileRow = await prisma.file_uploads.findFirst({
    where: { id: fileId, module: MAKETY_FILE_MODULE, record_id: maketaId },
  });
  if (!fileRow) {
    return NextResponse.json({ error: "Soubor nenalezen" }, { status: 404 });
  }

  const fromType = fileRow.document_type;
  await prisma.file_uploads.update({
    where: { id: fileId },
    data: { document_type: kindParsed.kind },
  });

  await recordMaketyFileEvent({
    maketaId,
    fileId,
    eventType: "type_changed",
    userId,
    meta: {
      filename: fileRow.original_filename,
      from: fromType,
      to: kindParsed.kind,
    },
  });

  return NextResponse.json({ success: true, document_type: kindParsed.kind });
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

  await recordMaketyFileEvent({
    maketaId,
    fileId: fileRow.id,
    eventType: "deleted",
    userId,
    meta: {
      filename: fileRow.original_filename,
      document_type: fileRow.document_type,
    },
  });

  await prisma.file_uploads.delete({ where: { id: fileId } });
  return NextResponse.json({ success: true });
}
