import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { Readable } from "node:stream";
import { mkdir, stat, writeFile } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { parseMaterialType } from "@/lib/training/material-types";
import {
  TRAINING_MATERIAL_UPLOAD_DIR,
  TRAINING_MATERIAL_UPLOAD_MODULE,
  contentDisposition,
  deleteMaterialUploads,
  diskPathFromWebPath,
  documentTypeForMaterialType,
  inferUploadMime,
  isAllowedUploadMime,
  maxBytesForMaterialType,
  trainingMaterialUploadDiskPath,
  trainingMaterialUploadWebPath,
} from "@/lib/training/material-upload";
import { getMaterialFileServeUrl } from "@/lib/training/material-api";

export const runtime = "nodejs";

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

async function requireRead(): Promise<{ userId: number } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Neautorizováno", { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "read"))) {
    return new NextResponse("Nemáte oprávnění", { status: 403 });
  }
  return { userId };
}

function streamResponse(
  diskPath: string,
  headers: Record<string, string>,
  range?: { start: number; end: number }
): NextResponse {
  const nodeStream = createReadStream(
    diskPath,
    range ? { start: range.start, end: range.end } : undefined
  );
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  const status = range ? 206 : 200;
  return new NextResponse(webStream, { status, headers });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireRead();
    if (access instanceof NextResponse) return access;

    const materialId = parseInt((await params).id, 10);
    if (isNaN(materialId)) {
      return new NextResponse("Neplatné ID", { status: 400 });
    }

    const forceDownload = req.nextUrl.searchParams.get("download") === "1";

    const material = await prisma.learning_materials.findUnique({
      where: { id: materialId },
      select: { id: true, material_type: true },
    });
    if (!material) {
      return new NextResponse("Materiál nenalezen", { status: 404 });
    }

    const fileRow = await prisma.file_uploads.findFirst({
      where: { module: TRAINING_MATERIAL_UPLOAD_MODULE, record_id: materialId },
      orderBy: { created_at: "desc" },
    });
    if (!fileRow) {
      return new NextResponse("Soubor nenalezen", { status: 404 });
    }

    const diskPath = diskPathFromWebPath(fileRow.file_path);
    let fileStat;
    try {
      fileStat = await stat(diskPath);
    } catch {
      return new NextResponse(
        "Soubor na serveru chybí. Nahrajte materiál znovu v administraci.",
        { status: 404 }
      );
    }

    const size = fileStat.size;
    const mime = inferUploadMime(fileRow.original_filename, fileRow.mime_type || "");
    const materialType = parseMaterialType(material.material_type);
    const inline = !forceDownload && (materialType === "video" || mime === "application/pdf");

    const baseHeaders: Record<string, string> = {
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Content-Disposition": contentDisposition(fileRow.original_filename, inline),
      "Cache-Control": "private, no-store",
    };

    const rangeHeader = req.headers.get("range");
    if (rangeHeader) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : size - 1;
        if (start >= size || end >= size || start > end) {
          return new NextResponse(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${size}` },
          });
        }
        const length = end - start + 1;
        return streamResponse(diskPath, {
          ...baseHeaders,
          "Content-Length": String(length),
          "Content-Range": `bytes ${start}-${end}/${size}`,
        }, { start, end });
      }
    }

    return streamResponse(diskPath, {
      ...baseHeaders,
      "Content-Length": String(size),
    });
  } catch (e) {
    console.error("GET /api/training/materials/[id]/file", e);
    return new NextResponse("Chyba při načítání souboru", { status: 500 });
  }
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

  const mime = inferUploadMime(file.name, file.type || "");
  if (!isAllowedUploadMime(materialType, mime, file.name)) {
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
          : mime === "video/quicktime"
            ? ".mov"
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
      serve_url: getMaterialFileServeUrl(materialId),
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
