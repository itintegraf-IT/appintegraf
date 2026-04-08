import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { ensurePersonalistikaTables } from "@/lib/personalistika-db";
import { logPersonalistikaAudit } from "@/lib/personalistika-audit";

const MODULE = "personalistika";
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, MODULE, "read"))) {
    return NextResponse.json({ error: "Nemáte přístup." }, { status: 403 });
  }

  await ensurePersonalistikaTables();
  const applicationId = parseInt((await params).id, 10);
  if (!Number.isFinite(applicationId)) return NextResponse.json({ error: "Neplatné ID." }, { status: 400 });

  const files = await prisma.file_uploads.findMany({
    where: { module: MODULE, record_id: applicationId },
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
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, MODULE, "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění nahrávat přílohy." }, { status: 403 });
  }

  await ensurePersonalistikaTables();
  const applicationId = parseInt((await params).id, 10);
  if (!Number.isFinite(applicationId)) return NextResponse.json({ error: "Neplatné ID." }, { status: 400 });

  const appRows = (await prisma.$queryRawUnsafe(
    `SELECT id FROM hr_candidate_applications WHERE id = ? LIMIT 1`,
    applicationId
  )) as { id: number }[];
  if (!appRows[0]) return NextResponse.json({ error: "Dotazník nebyl nalezen." }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Vyberte soubor." }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: "Povolené typy: PDF, Word, JPG, PNG, WEBP." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Soubor je větší než 20 MB." }, { status: 400 });

  const uploadDir = path.join(process.cwd(), "public", "uploads", "personalistika");
  await mkdir(uploadDir, { recursive: true });

  const ext = path.extname(file.name) || ".bin";
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${ext}`;
  const diskPath = path.join(uploadDir, safeName);
  const webPath = `/uploads/personalistika/${safeName}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(diskPath, buf);

  const row = await prisma.file_uploads.create({
    data: {
      filename: safeName,
      original_filename: file.name.slice(0, 250),
      file_path: webPath,
      file_size: buf.length,
      mime_type: mime.slice(0, 100),
      module: MODULE,
      record_id: applicationId,
      uploaded_by: userId,
      is_public: false,
    },
    include: { users: { select: { first_name: true, last_name: true } } },
  });

  await logPersonalistikaAudit({
    userId,
    action: "upload:application_file",
    tableName: "file_uploads",
    recordId: row.id,
    newValues: { application_id: applicationId, original_filename: row.original_filename },
  });

  return NextResponse.json({ file: row });
}
