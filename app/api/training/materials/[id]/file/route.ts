import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { parseMaterialType } from "@/lib/training/material-types";
import {
  TRAINING_MATERIAL_UPLOAD_DIR,
  TRAINING_MATERIAL_UPLOAD_MODULE,
  allowedMimeForMaterialType,
  deleteMaterialUploads,
  documentTypeForMaterialType,
  maxBytesForMaterialType,
  trainingMaterialUploadDiskPath,
  trainingMaterialUploadWebPath,
} from "@/lib/training/material-upload";

async function requireWrite(): Promise<{ userId: number } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění nahrávat soubory" }, { status: 403 });
  }
  return { userId };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireWrite();
  if (access instanceof NextResponse) return access;

  const materialId = parseInt((await params).id, 10);
  if (isNaN(materialId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const material = await prisma.learning_materials.findUnique({
    where: { id: materialId },
    select: { id: true, material_type: true },
  });
  if (!material) {
    return NextResponse.json({ error: "Materiál nenalezen" }, { status: 404 });
  }

  const materialType = parseMaterialType(material.material_type);
  if (materialType === "text") {
    return NextResponse.json({ error: "Textový materiál nepodporuje soubor" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Vyberte soubor" }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  const allowed = allowedMimeForMaterialType(materialType);
  if (!allowed.has(mime)) {
    return NextResponse.json({ error: "Nepovolený typ souboru pro tento materiál" }, { status: 400 });
  }

  const maxBytes = maxBytesForMaterialType(materialType);
  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    return NextResponse.json({ error: `Soubor je větší než ${maxMb} MB` }, { status: 400 });
  }

  await deleteMaterialUploads(materialId);
  await mkdir(TRAINING_MATERIAL_UPLOAD_DIR, { recursive: true });

  const ext =
    path.extname(file.name) ||
    (mime === "application/pdf"
      ? ".pdf"
      : mime === "video/mp4"
        ? ".mp4"
        : mime === "video/webm"
          ? ".webm"
          : mime.includes("presentation")
            ? ".pptx"
            : ".bin");
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${ext}`;
  const diskPath = trainingMaterialUploadDiskPath(safeName);
  const webPath = trainingMaterialUploadWebPath(safeName);

  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(diskPath, buf);

  const row = await prisma.file_uploads.create({
    data: {
      filename: safeName,
      original_filename: file.name.slice(0, 250),
      file_path: webPath,
      file_size: buf.length,
      mime_type: mime.slice(0, 100),
      module: TRAINING_MATERIAL_UPLOAD_MODULE,
      record_id: materialId,
      document_type: documentTypeForMaterialType(materialType),
      uploaded_by: access.userId,
      is_public: false,
    },
  });

  return NextResponse.json({
    success: true,
    file: {
      id: row.id,
      original_filename: row.original_filename,
      file_path: row.file_path,
      mime_type: row.mime_type,
      file_size: row.file_size,
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireWrite();
  if (access instanceof NextResponse) return access;

  const materialId = parseInt((await params).id, 10);
  if (isNaN(materialId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const material = await prisma.learning_materials.findUnique({
    where: { id: materialId },
    select: { id: true },
  });
  if (!material) {
    return NextResponse.json({ error: "Materiál nenalezen" }, { status: 404 });
  }

  await deleteMaterialUploads(materialId);
  return NextResponse.json({ success: true });
}
