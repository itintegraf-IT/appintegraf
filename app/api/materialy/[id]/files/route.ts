import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { canReadMaterialCatalog, canWriteMaterialCatalog } from "@/lib/materialy/access";
import { logMaterialyAuditSafe } from "@/lib/materialy/audit";
import {
  MATERIALY_ALLOWED_MIME,
  MATERIALY_MAX_BYTES,
  MATERIALY_UPLOAD_MODULE,
} from "@/lib/materialy/upload";

const DOC_TYPES = new Set(["SDS", "TDS", "CERTIFICATE", "OTHER"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadMaterialCatalog(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const materialId = parseInt((await params).id, 10);
  if (Number.isNaN(materialId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  try {
    const files = await prisma.file_uploads.findMany({
      where: { module: MATERIALY_UPLOAD_MODULE, record_id: materialId },
      orderBy: { created_at: "desc" },
      include: { users: { select: { first_name: true, last_name: true } } },
    });

    return NextResponse.json({ files });
  } catch (e) {
    console.error("materialy/[id]/files GET:", e);
    return NextResponse.json({ error: "Chyba při načítání souborů" }, { status: 500 });
  }
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
  if (!(await canWriteMaterialCatalog(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const materialId = parseInt((await params).id, 10);
  if (Number.isNaN(materialId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const exists = await prisma.materials.findUnique({ where: { id: materialId }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "Materiál nenalezen" }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const documentType = String(formData.get("document_type") ?? "SDS").toUpperCase();
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Vyberte soubor." }, { status: 400 });
    }
    if (!DOC_TYPES.has(documentType)) {
      return NextResponse.json({ error: "Neplatný typ dokumentu." }, { status: 400 });
    }

    const mime = file.type || "application/octet-stream";
    if (!MATERIALY_ALLOWED_MIME.has(mime)) {
      return NextResponse.json({ error: "Nepovolený typ souboru." }, { status: 400 });
    }
    if (file.size > MATERIALY_MAX_BYTES) {
      return NextResponse.json({ error: "Soubor je větší než 20 MB." }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "materialy");
    await mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.name) || ".bin";
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${ext}`;
    const diskPath = path.join(uploadDir, safeName);
    const webPath = `/uploads/materialy/${safeName}`;

    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(diskPath, buf);

    const row = await prisma.file_uploads.create({
      data: {
        filename: safeName,
        original_filename: file.name.slice(0, 250),
        file_path: webPath,
        file_size: buf.length,
        mime_type: mime.slice(0, 100),
        module: MATERIALY_UPLOAD_MODULE,
        record_id: materialId,
        document_type: documentType,
        uploaded_by: userId,
        is_public: false,
      },
      include: { users: { select: { first_name: true, last_name: true } } },
    });

    await logMaterialyAuditSafe({
      userId,
      action: "upload:material_file",
      tableName: "file_uploads",
      recordId: row.id,
      newValues: { material_id: materialId, document_type: documentType },
    });

    return NextResponse.json({ file: row });
  } catch (e) {
    console.error("materialy/[id]/files POST:", e);
    return NextResponse.json({ error: "Chyba při nahrávání souboru" }, { status: 500 });
  }
}
