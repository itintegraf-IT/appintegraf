import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createReadStream } from "fs";
import { access } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { canReadTechnologie } from "@/lib/technologie/access";
import { TECHNOLOGIE_DOC_THUMBNAIL, TECHNOLOGIE_MODULE } from "@/lib/technologie/constants";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
  if (Number.isNaN(recordId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const record = await prisma.technologie.findUnique({
    where: { id: recordId },
    select: { id: true, preview_updated_at: true },
  });
  if (!record) {
    return NextResponse.json({ error: "Záznam nenalezen" }, { status: 404 });
  }

  const fileRow = await prisma.file_uploads.findFirst({
    where: {
      module: TECHNOLOGIE_MODULE,
      record_id: recordId,
      document_type: TECHNOLOGIE_DOC_THUMBNAIL,
    },
    orderBy: { created_at: "desc" },
  });
  if (!fileRow) {
    return NextResponse.json({ error: "Náhled není k dispozici" }, { status: 404 });
  }

  const abs = path.join(process.cwd(), "public", fileRow.file_path.replace(/^\//, ""));
  try {
    await access(abs);
  } catch {
    return NextResponse.json({ error: "Soubor na disku chybí" }, { status: 404 });
  }

  const nodeStream = createReadStream(abs);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  const cacheBust =
    record.preview_updated_at?.getTime() ??
    fileRow.created_at.getTime();
  const etag = `"technologie-preview-${recordId}-${cacheBust}"`;

  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304 });
  }

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(fileRow.file_size),
      "Cache-Control": "private, max-age=3600",
      ETag: etag,
    },
  });
}
