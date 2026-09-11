import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { mkdir, writeFile } from "fs/promises";
import {
  IML_DIE_CUT_DOC_TYPE,
  IML_DIE_CUT_MAX_BYTES,
  IML_DIE_CUT_MAX_FILES,
  IML_DIE_CUT_MAX_MB,
  IML_DIE_CUT_UPLOAD_DIR,
  IML_DIE_CUT_UPLOAD_MODULE,
  dieCutFileExtension,
  imlDieCutUploadDiskPath,
  imlDieCutUploadWebPath,
  isAllowedDieCutCadFile,
  mimeForDieCutCadFile,
} from "@/lib/iml-die-cut-upload";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const dieCutId = parseInt((await params).id, 10);
  if (Number.isNaN(dieCutId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const exists = await prisma.iml_die_cuts.findUnique({
    where: { id: dieCutId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Výsek nenalezen" }, { status: 404 });
  }

  const files = await prisma.file_uploads.findMany({
    where: {
      module: IML_DIE_CUT_UPLOAD_MODULE,
      record_id: dieCutId,
      document_type: IML_DIE_CUT_DOC_TYPE,
    },
    orderBy: { created_at: "desc" },
    include: {
      users: { select: { first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({ files, max_files: IML_DIE_CUT_MAX_FILES });
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
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění nahrávat přílohy." }, { status: 403 });
  }

  const dieCutId = parseInt((await params).id, 10);
  if (Number.isNaN(dieCutId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const dieCut = await prisma.iml_die_cuts.findUnique({
    where: { id: dieCutId },
    select: { id: true },
  });
  if (!dieCut) {
    return NextResponse.json({ error: "Výsek nenalezen" }, { status: 404 });
  }

  const existingCount = await prisma.file_uploads.count({
    where: {
      module: IML_DIE_CUT_UPLOAD_MODULE,
      record_id: dieCutId,
      document_type: IML_DIE_CUT_DOC_TYPE,
    },
  });
  if (existingCount >= IML_DIE_CUT_MAX_FILES) {
    return NextResponse.json(
      { error: `Maximálně ${IML_DIE_CUT_MAX_FILES} přílohy na výsek.` },
      { status: 400 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Vyberte soubor." }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  if (!isAllowedDieCutCadFile(file.name, mime)) {
    return NextResponse.json(
      { error: "Nepovolený typ souboru (PDF, DXF, DWG)." },
      { status: 400 }
    );
  }
  if (file.size > IML_DIE_CUT_MAX_BYTES) {
    return NextResponse.json(
      { error: `Soubor je větší než ${IML_DIE_CUT_MAX_MB} MB.` },
      { status: 400 }
    );
  }

  await mkdir(IML_DIE_CUT_UPLOAD_DIR, { recursive: true });

  const ext = dieCutFileExtension(file.name) || ".bin";
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${ext}`;
  const diskPath = imlDieCutUploadDiskPath(safeName);
  const webPath = imlDieCutUploadWebPath(safeName);

  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(diskPath, buf);

  const row = await prisma.file_uploads.create({
    data: {
      filename: safeName,
      original_filename: file.name.slice(0, 250),
      file_path: webPath,
      file_size: buf.length,
      mime_type: mimeForDieCutCadFile(file.name, mime),
      module: IML_DIE_CUT_UPLOAD_MODULE,
      record_id: dieCutId,
      document_type: IML_DIE_CUT_DOC_TYPE,
      uploaded_by: userId,
      is_public: false,
    },
    include: {
      users: { select: { first_name: true, last_name: true } },
    },
  });

  await logImlAudit({
    userId,
    action: "create",
    tableName: "file_uploads",
    recordId: row.id,
    newValues: {
      die_cut_id: dieCutId,
      original_filename: row.original_filename,
      document_type: IML_DIE_CUT_DOC_TYPE,
    },
  });

  return NextResponse.json({ file: row });
}
