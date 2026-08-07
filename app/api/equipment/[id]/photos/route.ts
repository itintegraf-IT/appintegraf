import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { canReadEquipment, canWriteEquipment } from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";
import {
  EQUIPMENT_UPLOAD_MODULE,
  EQUIPMENT_PHOTO_MAX_BYTES,
  EQUIPMENT_PHOTO_MIME,
  EQUIPMENT_ATTACHMENT_MAX_BYTES,
  EQUIPMENT_ATTACHMENT_MIME,
} from "@/lib/equipment/upload";

async function getItemOr403(id: number, userId: number, write: boolean) {
  const item = await prisma.equipment_items.findUnique({
    where: { id },
    select: { id: true, category_id: true },
  });
  if (!item) return { error: NextResponse.json({ error: "Nenalezeno" }, { status: 404 }) };
  const ok = write
    ? await canWriteEquipment(userId, item.category_id)
    : await canReadEquipment(userId, item.category_id);
  if (!ok) return { error: NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 }) };
  return { item };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const check = await getItemOr403(id, userId, false);
  if ("error" in check && check.error) return check.error;

  const kind = req.nextUrl.searchParams.get("kind") ?? "photo";
  const docTypes =
    kind === "attachment"
      ? ["attachment", "invoice", "delivery_note", "warranty", "service", "other"]
      : ["photo", "photo_cover"];

  const files = await prisma.file_uploads.findMany({
    where: {
      module: EQUIPMENT_UPLOAD_MODULE,
      record_id: id,
      document_type: { in: docTypes },
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
  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const check = await getItemOr403(id, userId, true);
  if ("error" in check && check.error) return check.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    let documentType = String(formData.get("document_type") ?? "photo").toLowerCase();
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Vyberte soubor." }, { status: 400 });
    }

    const mime = file.type || "application/octet-stream";
    const isPhoto = documentType === "photo" || documentType === "photo_cover";
    if (isPhoto) {
      if (!EQUIPMENT_PHOTO_MIME.has(mime)) {
        return NextResponse.json({ error: "Nepovolený typ fotky." }, { status: 400 });
      }
      if (file.size > EQUIPMENT_PHOTO_MAX_BYTES) {
        return NextResponse.json({ error: "Fotka je větší než 10 MB." }, { status: 400 });
      }
    } else {
      if (!["attachment", "invoice", "delivery_note", "warranty", "service", "other"].includes(documentType)) {
        documentType = "attachment";
      }
      if (!EQUIPMENT_ATTACHMENT_MIME.has(mime)) {
        return NextResponse.json({ error: "Nepovolený typ přílohy." }, { status: 400 });
      }
      if (file.size > EQUIPMENT_ATTACHMENT_MAX_BYTES) {
        return NextResponse.json({ error: "Soubor je větší než 20 MB." }, { status: 400 });
      }
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "equipment", String(id));
    await mkdir(uploadDir, { recursive: true });
    const ext = path.extname(file.name) || (mime.includes("png") ? ".png" : ".jpg");
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${ext}`;
    const diskPath = path.join(uploadDir, safeName);
    const webPath = `/uploads/equipment/${id}/${safeName}`;
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(diskPath, buf);

    const row = await prisma.file_uploads.create({
      data: {
        filename: safeName,
        original_filename: file.name.slice(0, 250),
        file_path: webPath,
        file_size: buf.length,
        mime_type: mime.slice(0, 100),
        module: EQUIPMENT_UPLOAD_MODULE,
        record_id: id,
        document_type: documentType,
        uploaded_by: userId,
        is_public: false,
      },
    });

    if (documentType === "photo_cover" || documentType === "photo") {
      const item = await prisma.equipment_items.findUnique({
        where: { id },
        select: { cover_file_id: true },
      });
      if (!item?.cover_file_id || documentType === "photo_cover") {
        await prisma.equipment_items.update({
          where: { id },
          data: { cover_file_id: row.id, updated_at: new Date() },
        });
        if (documentType === "photo") {
          await prisma.file_uploads.update({
            where: { id: row.id },
            data: { document_type: "photo_cover" },
          });
        }
      }
    }

    await logEquipmentAuditSafe({
      userId,
      action: isPhoto ? "photo_upload" : "attachment_upload",
      tableName: "file_uploads",
      recordId: row.id,
      detail: { equipmentId: id, document_type: documentType },
    });

    return NextResponse.json({ file: row });
  } catch (e) {
    console.error("equipment photos POST:", e);
    return NextResponse.json({ error: "Chyba při nahrávání" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  const id = parseInt((await params).id, 10);
  const fileId = parseInt(req.nextUrl.searchParams.get("fileId") ?? "", 10);
  if (Number.isNaN(id) || Number.isNaN(fileId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const check = await getItemOr403(id, userId, true);
  if ("error" in check && check.error) return check.error;

  const fileRow = await prisma.file_uploads.findFirst({
    where: { id: fileId, module: EQUIPMENT_UPLOAD_MODULE, record_id: id },
  });
  if (!fileRow) return NextResponse.json({ error: "Soubor nenalezen" }, { status: 404 });

  try {
    const disk = path.join(process.cwd(), "public", fileRow.file_path.replace(/^\//, ""));
    await unlink(disk).catch(() => undefined);
  } catch {
    /* ignore */
  }

  await prisma.file_uploads.delete({ where: { id: fileId } });
  const item = await prisma.equipment_items.findUnique({
    where: { id },
    select: { cover_file_id: true },
  });
  if (item?.cover_file_id === fileId) {
    await prisma.equipment_items.update({
      where: { id },
      data: { cover_file_id: null, updated_at: new Date() },
    });
  }

  await logEquipmentAuditSafe({
    userId,
    action: "photo_delete",
    tableName: "file_uploads",
    recordId: fileId,
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  const id = parseInt((await params).id, 10);
  const body = await req.json().catch(() => ({}));
  const fileId = parseInt(String(body.fileId ?? ""), 10);
  if (Number.isNaN(id) || Number.isNaN(fileId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const check = await getItemOr403(id, userId, true);
  if ("error" in check && check.error) return check.error;

  await prisma.file_uploads.updateMany({
    where: { module: EQUIPMENT_UPLOAD_MODULE, record_id: id, document_type: "photo_cover" },
    data: { document_type: "photo" },
  });
  await prisma.file_uploads.update({
    where: { id: fileId },
    data: { document_type: "photo_cover" },
  });
  await prisma.equipment_items.update({
    where: { id },
    data: { cover_file_id: fileId, updated_at: new Date() },
  });

  return NextResponse.json({ ok: true });
}
