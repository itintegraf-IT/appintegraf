import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import {
  type CatalogAttachmentKind,
  IML_CATALOG_ATTACHMENT_DOC_TYPE,
  IML_CATALOG_ATTACHMENT_MAX_BYTES,
  IML_CATALOG_ATTACHMENT_MAX_FILES,
  IML_CATALOG_ATTACHMENT_MAX_MB,
  catalogAttachmentExtension,
  catalogUploadDir,
  catalogUploadDiskPath,
  catalogUploadModule,
  catalogUploadWebPath,
  diskPathFromCatalogWebPath,
  isAllowedCatalogAttachment,
  mimeForCatalogAttachment,
} from "@/lib/iml-catalog-attachments";

function contentDisposition(filename: string, disposition: "inline" | "attachment"): string {
  const safe = filename.replace(/["\r\n]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `${disposition}; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

async function entityExists(kind: CatalogAttachmentKind, id: number): Promise<boolean> {
  if (kind === "shape") {
    const row = await prisma.iml_shape_catalog.findUnique({
      where: { id },
      select: { id: true },
    });
    return !!row;
  }
  const row = await prisma.iml_tool_catalog.findUnique({
    where: { id },
    select: { id: true },
  });
  return !!row;
}

function notFoundLabel(kind: CatalogAttachmentKind): string {
  return kind === "shape" ? "Tvar nenalezen" : "Nástroj nenalezen";
}

export async function listCatalogAttachments(kind: CatalogAttachmentKind, recordId: number) {
  const module = catalogUploadModule(kind);
  return prisma.file_uploads.findMany({
    where: {
      module,
      record_id: recordId,
      document_type: IML_CATALOG_ATTACHMENT_DOC_TYPE,
    },
    orderBy: { created_at: "desc" },
    include: {
      users: { select: { first_name: true, last_name: true } },
    },
  });
}

export async function handleCatalogAttachmentsGet(
  kind: CatalogAttachmentKind,
  params: Promise<{ id: string }>
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }
  if (!(await entityExists(kind, id))) {
    return NextResponse.json({ error: notFoundLabel(kind) }, { status: 404 });
  }

  const files = await listCatalogAttachments(kind, id);
  return NextResponse.json({
    files,
    max_files: IML_CATALOG_ATTACHMENT_MAX_FILES,
  });
}

export async function handleCatalogAttachmentsPost(
  kind: CatalogAttachmentKind,
  req: NextRequest,
  params: Promise<{ id: string }>
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění nahrávat přílohy." }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }
  if (!(await entityExists(kind, id))) {
    return NextResponse.json({ error: notFoundLabel(kind) }, { status: 404 });
  }

  const module = catalogUploadModule(kind);
  const existingCount = await prisma.file_uploads.count({
    where: {
      module,
      record_id: id,
      document_type: IML_CATALOG_ATTACHMENT_DOC_TYPE,
    },
  });
  if (existingCount >= IML_CATALOG_ATTACHMENT_MAX_FILES) {
    return NextResponse.json(
      { error: `Maximálně ${IML_CATALOG_ATTACHMENT_MAX_FILES} příloh.` },
      { status: 400 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Vyberte soubor." }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  if (!isAllowedCatalogAttachment(file.name, mime)) {
    return NextResponse.json(
      { error: "Nepovolený typ (PDF, JPG, PNG, DXF, DWG, CAD)." },
      { status: 400 }
    );
  }
  if (file.size > IML_CATALOG_ATTACHMENT_MAX_BYTES) {
    return NextResponse.json(
      { error: `Soubor je větší než ${IML_CATALOG_ATTACHMENT_MAX_MB} MB.` },
      { status: 400 }
    );
  }

  await mkdir(catalogUploadDir(kind), { recursive: true });

  const ext = catalogAttachmentExtension(file.name) || ".bin";
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${ext}`;
  const diskPath = catalogUploadDiskPath(kind, safeName);
  const webPath = catalogUploadWebPath(kind, safeName);

  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(diskPath, buf);

  const row = await prisma.file_uploads.create({
    data: {
      filename: safeName,
      original_filename: file.name.slice(0, 250),
      file_path: webPath,
      file_size: buf.length,
      mime_type: mimeForCatalogAttachment(file.name, mime),
      module,
      record_id: id,
      document_type: IML_CATALOG_ATTACHMENT_DOC_TYPE,
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
      [kind === "shape" ? "shape_id" : "tool_id"]: id,
      original_filename: row.original_filename,
      document_type: IML_CATALOG_ATTACHMENT_DOC_TYPE,
    },
  });

  return NextResponse.json({ file: row });
}

export async function handleCatalogAttachmentFileGet(
  kind: CatalogAttachmentKind,
  req: NextRequest,
  params: Promise<{ id: string; fileId: string }>
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Neautorizováno", { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return new NextResponse("Nemáte oprávnění", { status: 403 });
  }

  const recordId = parseInt((await params).id, 10);
  const fileId = parseInt((await params).fileId, 10);
  if (Number.isNaN(recordId) || Number.isNaN(fileId)) {
    return new NextResponse("Neplatné ID", { status: 400 });
  }

  const fileRow = await prisma.file_uploads.findFirst({
    where: {
      id: fileId,
      module: catalogUploadModule(kind),
      record_id: recordId,
    },
  });
  if (!fileRow) {
    return new NextResponse("Soubor nenalezen", { status: 404 });
  }

  let buf: Buffer;
  try {
    buf = await readFile(diskPathFromCatalogWebPath(fileRow.file_path));
  } catch {
    return new NextResponse("Soubor na serveru chybí", { status: 404 });
  }

  const asDownload = req.nextUrl.searchParams.get("download") === "1";
  const mime = fileRow.mime_type?.trim() || "application/octet-stream";
  const canInline =
    mime.includes("pdf") || mime.startsWith("image/");

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": contentDisposition(
        fileRow.original_filename,
        asDownload || !canInline ? "attachment" : "inline"
      ),
      "Content-Length": String(buf.length),
      "Cache-Control": "private, no-store",
    },
  });
}

export async function handleCatalogAttachmentFileDelete(
  kind: CatalogAttachmentKind,
  params: Promise<{ id: string; fileId: string }>
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění smazat přílohu." }, { status: 403 });
  }

  const recordId = parseInt((await params).id, 10);
  const fileId = parseInt((await params).fileId, 10);
  if (Number.isNaN(recordId) || Number.isNaN(fileId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const fileRow = await prisma.file_uploads.findFirst({
    where: {
      id: fileId,
      module: catalogUploadModule(kind),
      record_id: recordId,
    },
  });
  if (!fileRow) {
    return NextResponse.json({ error: "Soubor nenalezen" }, { status: 404 });
  }

  try {
    await unlink(diskPathFromCatalogWebPath(fileRow.file_path));
  } catch {
    // missing on disk
  }

  await prisma.file_uploads.delete({ where: { id: fileId } });

  await logImlAudit({
    userId,
    action: "delete",
    tableName: "file_uploads",
    recordId: fileId,
    oldValues: {
      [kind === "shape" ? "shape_id" : "tool_id"]: recordId,
      original_filename: fileRow.original_filename,
    },
  });

  return NextResponse.json({ success: true });
}
