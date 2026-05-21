import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  IML_CUSTOMER_ALLOWED_MIME,
  IML_CUSTOMER_MAX_BYTES,
  IML_CUSTOMER_UPLOAD_DIR,
  IML_CUSTOMER_UPLOAD_MODULE,
  imlCustomerUploadDiskPath,
  imlCustomerUploadWebPath,
} from "@/lib/iml-customer-upload";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const canRead = await hasModuleAccess(userId, "iml", "read");
  if (!canRead) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const customerId = parseInt((await params).id, 10);
  if (Number.isNaN(customerId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const exists = await prisma.iml_customers.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Zákazník nenalezen" }, { status: 404 });
  }

  const files = await prisma.file_uploads.findMany({
    where: { module: IML_CUSTOMER_UPLOAD_MODULE, record_id: customerId },
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
  const canWrite = await hasModuleAccess(userId, "iml", "write");
  if (!canWrite) {
    return NextResponse.json({ error: "Nemáte oprávnění nahrávat přílohy." }, { status: 403 });
  }

  const customerId = parseInt((await params).id, 10);
  if (Number.isNaN(customerId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const customer = await prisma.iml_customers.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Zákazník nenalezen" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Vyberte soubor." }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  if (!IML_CUSTOMER_ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      { error: "Nepovolený typ souboru (PDF, Word, Excel)." },
      { status: 400 }
    );
  }
  if (file.size > IML_CUSTOMER_MAX_BYTES) {
    return NextResponse.json({ error: "Soubor je větší než 20 MB." }, { status: 400 });
  }

  await mkdir(IML_CUSTOMER_UPLOAD_DIR, { recursive: true });

  const ext =
    path.extname(file.name) ||
    (mime === "application/pdf"
      ? ".pdf"
      : mime.includes("word")
        ? ".docx"
        : mime.includes("sheet") || mime.includes("excel")
          ? ".xlsx"
          : ".bin");
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${ext}`;
  const diskPath = imlCustomerUploadDiskPath(safeName);
  const webPath = imlCustomerUploadWebPath(safeName);

  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(diskPath, buf);

  const row = await prisma.file_uploads.create({
    data: {
      filename: safeName,
      original_filename: file.name.slice(0, 250),
      file_path: webPath,
      file_size: buf.length,
      mime_type: mime.slice(0, 100),
      module: IML_CUSTOMER_UPLOAD_MODULE,
      record_id: customerId,
      uploaded_by: userId,
      is_public: false,
    },
    include: {
      users: { select: { first_name: true, last_name: true } },
    },
  });

  await logImlAudit({
    userId,
    action: "upload:customer_file",
    tableName: "file_uploads",
    recordId: row.id,
    newValues: {
      customer_id: customerId,
      original_filename: row.original_filename,
    },
  });

  return NextResponse.json({ file: row });
}
