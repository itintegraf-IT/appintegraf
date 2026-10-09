import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createReadStream } from "fs";
import { access } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { canReadTechnologie, canWriteTechnologie } from "@/lib/technologie/access";
import {
  mimeTypeForTechnologieFilename,
  TECHNOLOGIE_DOC_PDF,
  TECHNOLOGIE_MODULE,
} from "@/lib/technologie/constants";
import { deleteTechnologiePdfAndThumbnail } from "@/lib/technologie/files";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadTechnologie(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const recordId = parseInt((await params).id, 10);
  const fileId = parseInt((await params).fileId, 10);
  if (Number.isNaN(recordId) || Number.isNaN(fileId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const fileRow = await prisma.file_uploads.findFirst({
    where: {
      id: fileId,
      module: TECHNOLOGIE_MODULE,
      record_id: recordId,
      document_type: TECHNOLOGIE_DOC_PDF,
    },
  });
  if (!fileRow) {
    return NextResponse.json({ error: "Soubor nenalezen" }, { status: 404 });
  }

  const abs = path.join(process.cwd(), "public", fileRow.file_path.replace(/^\//, ""));
  try {
    await access(abs);
  } catch {
    return NextResponse.json({ error: "Soubor na disku chybí" }, { status: 404 });
  }

  const nodeStream = createReadStream(abs);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  await prisma.file_uploads.update({
    where: { id: fileId },
    data: { last_accessed_at: new Date() },
  });

  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const asciiName = fileRow.original_filename.replace(/[^\x20-\x7E]/g, "_");
  const contentType = mimeTypeForTechnologieFilename(
    fileRow.original_filename,
    fileRow.mime_type
  );
  const disposition = inline ? "inline" : "attachment";

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileRow.original_filename)}`,
      "Content-Length": String(fileRow.file_size),
    },
  });
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
  if (!(await canWriteTechnologie(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const recordId = parseInt((await params).id, 10);
  const fileId = parseInt((await params).fileId, 10);
  if (Number.isNaN(recordId) || Number.isNaN(fileId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const fileRow = await prisma.file_uploads.findFirst({
    where: {
      id: fileId,
      module: TECHNOLOGIE_MODULE,
      record_id: recordId,
      document_type: TECHNOLOGIE_DOC_PDF,
    },
  });
  if (!fileRow) {
    return NextResponse.json({ error: "Soubor nenalezen" }, { status: 404 });
  }

  await deleteTechnologiePdfAndThumbnail(recordId);
  await prisma.technologie.update({
    where: { id: recordId },
    data: { preview_updated_at: null, updated_at: new Date() },
  });

  return NextResponse.json({ success: true });
}
