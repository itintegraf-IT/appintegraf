import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import path from "path";
import { canReadTechnologie, canWriteTechnologie } from "@/lib/technologie/access";
import {
  TECHNOLOGIE_ALLOWED_EXTENSIONS,
  TECHNOLOGIE_DOC_PDF,
  TECHNOLOGIE_MAX_BYTES,
  TECHNOLOGIE_MODULE,
} from "@/lib/technologie/constants";
import { saveTechnologiePdfUpload } from "@/lib/technologie/files";

export async function GET(
  _req: NextRequest,
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

  const exists = await prisma.technologie.findUnique({
    where: { id: recordId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Záznam nenalezen" }, { status: 404 });
  }

  const files = await prisma.file_uploads.findMany({
    where: {
      module: TECHNOLOGIE_MODULE,
      record_id: recordId,
      document_type: TECHNOLOGIE_DOC_PDF,
    },
    orderBy: { created_at: "desc" },
    include: { users: { select: { first_name: true, last_name: true } } },
  });

  return NextResponse.json({ files });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
  if (Number.isNaN(recordId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const exists = await prisma.technologie.findUnique({
    where: { id: recordId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Záznam nenalezen" }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Vyberte soubor PDF." }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!TECHNOLOGIE_ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: "Povolený formát je pouze PDF." }, { status: 400 });
    }
    if (file.size > TECHNOLOGIE_MAX_BYTES) {
      return NextResponse.json({ error: "Soubor je větší než 50 MB." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const { pdfId, thumbnailCreated } = await saveTechnologiePdfUpload(
      recordId,
      userId,
      file.name,
      buf
    );

    const row = await prisma.file_uploads.findUnique({
      where: { id: pdfId },
      include: { users: { select: { first_name: true, last_name: true } } },
    });

    return NextResponse.json({ file: row, thumbnailCreated });
  } catch (e) {
    console.error("technologie files POST:", e);
    return NextResponse.json({ error: "Chyba při nahrávání souboru" }, { status: 500 });
  }
}
