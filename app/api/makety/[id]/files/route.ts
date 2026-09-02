import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { userCanViewMaketa, userCanEditMaketa } from "@/lib/makety-access";
import {
  isMaketyUploadAllowed,
  MAKETY_ALLOWED_FORMATS_LABEL,
  MAKETY_FILE_MODULE,
  MAKETY_MAX_BYTES,
  MAKETY_MAX_MB,
  MAKETY_MAX_FILES_PER_REQUEST,
} from "@/lib/makety-files";
import { requireMaketyFileKind, type MaketyFileKind } from "@/lib/makety-file-kind";
import { recordMaketyFileEvent } from "@/lib/makety-file-events";
import { isMaketaTerminalStatus } from "@/lib/makety-status";
import type { MaketyWorkType } from "@/lib/makety-work-type";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

async function saveMaketyFile(params: {
  file: File;
  maketaId: number;
  userId: number;
  documentType: MaketyFileKind;
}): Promise<{ ok: true; row: Awaited<ReturnType<typeof prisma.file_uploads.create>> } | { ok: false; error: string }> {
  const { file, maketaId, userId, documentType } = params;

  if (!isMaketyUploadAllowed({ name: file.name, type: file.type || "" })) {
    return {
      ok: false,
      error: `Soubor „${file.name}“: nepovolený typ (${MAKETY_ALLOWED_FORMATS_LABEL})`,
    };
  }
  if (file.size > MAKETY_MAX_BYTES) {
    return {
      ok: false,
      error: `Soubor „${file.name}“ je větší než ${MAKETY_MAX_MB} MB`,
    };
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "makety");
  await mkdir(uploadDir, { recursive: true });

  const ext = path.extname(file.name) || ".bin";
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${ext}`;
  const diskPath = path.join(uploadDir, safeName);
  const webPath = `/uploads/makety/${safeName}`;

  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(diskPath, buf);

  const mime = file.type || "application/octet-stream";
  const row = await prisma.file_uploads.create({
    data: {
      filename: safeName,
      original_filename: file.name.slice(0, 250),
      file_path: webPath,
      file_size: buf.length,
      mime_type: mime.slice(0, 100),
      module: MAKETY_FILE_MODULE,
      document_type: documentType,
      record_id: maketaId,
      uploaded_by: userId,
      is_public: false,
    },
    include: {
      users: { select: { first_name: true, last_name: true } },
    },
  });

  await recordMaketyFileEvent({
    maketaId,
    fileId: row.id,
    eventType: "uploaded",
    userId,
    meta: {
      filename: row.original_filename,
      document_type: documentType,
      file_size: row.file_size,
    },
  });

  return { ok: true, row };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
  if (Number.isNaN(maketaId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanViewMaketa(userId, maketaId))) {
    return NextResponse.json({ error: "Maketa nenalezena" }, { status: 404 });
  }

  const files = await prisma.file_uploads.findMany({
    where: { module: MAKETY_FILE_MODULE, record_id: maketaId },
    orderBy: { created_at: "desc" },
    include: {
      users: { select: { first_name: true, last_name: true } },
    },
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
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const maketaId = parseInt((await params).id, 10);
  if (Number.isNaN(maketaId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const exists = await prisma.makety.findUnique({
    where: { id: maketaId },
    select: { id: true, status: true, work_type: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Maketa nenalezena" }, { status: 404 });
  }

  const canUpload =
    (await userCanEditMaketa(userId, maketaId)) || (await userCanViewMaketa(userId, maketaId));
  if (!canUpload) {
    return NextResponse.json({ error: "Nemáte oprávnění nahrávat přílohy" }, { status: 403 });
  }
  const workType = (exists.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
  if (isMaketaTerminalStatus(exists.status, workType)) {
    return NextResponse.json({ error: "K archivované maketě nelze přidávat soubory" }, { status: 400 });
  }

  const formData = await req.formData();
  const kindParsed = requireMaketyFileKind(String(formData.get("document_type") ?? ""));
  if (!kindParsed.ok) {
    return NextResponse.json({ error: kindParsed.error }, { status: 400 });
  }

  const incoming = formData
    .getAll("file")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (incoming.length === 0) {
    return NextResponse.json({ error: "Vyberte alespoň jeden soubor" }, { status: 400 });
  }
  if (incoming.length > MAKETY_MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      { error: `Najednou lze nahrát maximálně ${MAKETY_MAX_FILES_PER_REQUEST} souborů` },
      { status: 400 }
    );
  }

  const uploaded: Awaited<ReturnType<typeof prisma.file_uploads.create>>[] = [];
  const errors: string[] = [];

  for (const file of incoming) {
    const result = await saveMaketyFile({
      file,
      maketaId,
      userId,
      documentType: kindParsed.kind,
    });
    if (result.ok) {
      uploaded.push(result.row);
    } else {
      errors.push(result.error);
    }
  }

  if (uploaded.length === 0) {
    return NextResponse.json(
      { error: errors.join(" ") || "Žádný soubor se nepodařilo nahrát" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    files: uploaded,
    file: uploaded[0],
    errors: errors.length > 0 ? errors : undefined,
    partial: errors.length > 0,
  });
}
