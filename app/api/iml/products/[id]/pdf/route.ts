import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";

const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20 MB

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Neautorizováno", { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return new NextResponse("Nemáte oprávnění", { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return new NextResponse("Neplatné ID", { status: 400 });
  }

  const product = await prisma.iml_products.findUnique({
    where: { id },
    select: { pdf_data: true },
  });

  if (!product?.pdf_data || product.pdf_data.length === 0) {
    return new NextResponse("PDF nenalezeno", { status: 404 });
  }

  const pdfBuf = Buffer.isBuffer(product.pdf_data) ? product.pdf_data : Buffer.from(product.pdf_data);
  return new NextResponse(new Uint8Array(pdfBuf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"tiskova-data.pdf\"",
      "Cache-Control": "private, max-age=3600",
    },
  });
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
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám IML" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.iml_products.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Produkt nenalezen" }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Nebyl nahrán žádný soubor" }, { status: 400 });
    }

    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json({ error: "PDF je příliš velké (max 20 MB)" }, { status: 400 });
    }

    const type = file.type?.toLowerCase();
    if (type !== "application/pdf") {
      return NextResponse.json({ error: "Povolený formát: PDF" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    console.log(`IML PDF upload: product ${id}, size ${buffer.length} bytes`);

    await prisma.iml_products.update({
      where: { id },
      data: { pdf_data: buffer },
    });

    await logImlAudit({
      userId,
      action: "update",
      tableName: "iml_products",
      recordId: id,
      newValues: { pdf_uploaded: true },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    const err = e as Error & { code?: string; cause?: unknown };
    console.error(
      "IML product PDF upload error:",
      err.message,
      "code:",
      err.code ?? (err as { meta?: { code?: string } }).meta?.code,
      "cause:",
      err.cause
    );
    return NextResponse.json({ error: "Chyba při nahrávání PDF" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám IML" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  await prisma.iml_products.update({
    where: { id },
    data: { pdf_data: null },
  });

  await logImlAudit({
    userId,
    action: "update",
    tableName: "iml_products",
    recordId: id,
    newValues: { pdf_deleted: true },
  });

  return NextResponse.json({ success: true });
}
