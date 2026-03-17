import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

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
    select: { image_data: true },
  });

  if (!product?.image_data || product.image_data.length === 0) {
    return new NextResponse("Obrázek nenalezen", { status: 404 });
  }

  const contentType = getImageContentType(product.image_data);
  const body = Buffer.isBuffer(product.image_data) ? product.image_data : Buffer.from(product.image_data);

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
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

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "Obrázek je příliš velký (max 5 MB)" }, { status: 400 });
    }

    const type = file.type?.toLowerCase();
    if (!type || !ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: "Povolené formáty: JPG, PNG, WebP, GIF" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    await prisma.iml_products.update({
      where: { id },
      data: { image_data: buffer },
    });

    await logImlAudit({
      userId,
      action: "update",
      tableName: "iml_products",
      recordId: id,
      newValues: { image_uploaded: true },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("IML product image upload error:", e);
    return NextResponse.json({ error: "Chyba při nahrávání obrázku" }, { status: 500 });
  }
}

function getImageContentType(buffer: Buffer | Uint8Array): string {
  const b = buffer as { [i: number]: number };
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return "image/webp";
  return "image/jpeg";
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
    data: { image_data: null },
  });

  await logImlAudit({
    userId,
    action: "update",
    tableName: "iml_products",
    recordId: id,
    newValues: { image_deleted: true },
  });

  return NextResponse.json({ success: true });
}
