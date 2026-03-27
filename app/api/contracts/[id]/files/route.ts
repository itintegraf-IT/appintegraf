import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { logContractAudit } from "@/lib/contracts/audit";
import { canManageContractRecord, canModifyAttachments } from "@/lib/contracts/access";

const MODULE = "contracts";
const MAX_BYTES = 20 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const contractId = parseInt((await params).id, 10);
  if (Number.isNaN(contractId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const exists = await prisma.contracts.findUnique({
    where: { id: contractId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Smlouva nenalezena" }, { status: 404 });
  }

  const files = await prisma.file_uploads.findMany({
    where: { module: MODULE, record_id: contractId },
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

  const contractId = parseInt((await params).id, 10);
  if (Number.isNaN(contractId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const userId = parseInt(session.user.id, 10);
  const admin = await isAdmin(userId);

  const contract = await prisma.contracts.findUnique({ where: { id: contractId } });
  if (!contract) {
    return NextResponse.json({ error: "Smlouva nenalezena" }, { status: 404 });
  }

  if (!canModifyAttachments(contract.approval_status)) {
    return NextResponse.json(
      { error: "U zamítnuté nebo archivované smlouvy nelze přidávat přílohy." },
      { status: 400 }
    );
  }

  if (!canManageContractRecord(contract, userId, admin)) {
    return NextResponse.json({ error: "Nemáte oprávnění nahrávat přílohy." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Vyberte soubor." }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      { error: "Nepovolený typ souboru (PDF, obrázky, Word, Excel)." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Soubor je větší než 20 MB." }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "contracts");
  await mkdir(uploadDir, { recursive: true });

  const ext =
    path.extname(file.name) ||
    (mime === "application/pdf"
      ? ".pdf"
      : mime.startsWith("image/")
        ? ".bin"
        : ".bin");
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${ext}`;
  const diskPath = path.join(uploadDir, safeName);
  const webPath = `/uploads/contracts/${safeName}`;

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
      record_id: contractId,
      uploaded_by: userId,
      is_public: false,
    },
    include: {
      users: { select: { first_name: true, last_name: true } },
    },
  });

  await logContractAudit({
    userId,
    action: "upload:contract_file",
    tableName: "file_uploads",
    recordId: row.id,
    newValues: { contract_id: contractId, original_filename: row.original_filename },
  });

  return NextResponse.json({ file: row });
}
