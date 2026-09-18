import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { canReadVykresy, canWriteVykresy } from "@/lib/vykresy/access";
import {
  VYKRESY_ALLOWED_EXTENSIONS,
  VYKRESY_MAX_BYTES,
  VYKRESY_MODULE,
} from "@/lib/vykresy/constants";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadVykresy(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const vykresId = parseInt((await params).id, 10);
  if (Number.isNaN(vykresId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const exists = await prisma.vykresy.findUnique({
    where: { id: vykresId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Záznam nenalezen" }, { status: 404 });
  }

  const files = await prisma.file_uploads.findMany({
    where: { module: VYKRESY_MODULE, record_id: vykresId },
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
  if (!(await canWriteVykresy(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const vykresId = parseInt((await params).id, 10);
  if (Number.isNaN(vykresId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const exists = await prisma.vykresy.findUnique({
    where: { id: vykresId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Záznam nenalezen" }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Vyberte soubor." }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!VYKRESY_ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          error:
            "Nepovolená přípona. Povoleno: STL, 3MF, OBJ, STEP/STP, IGES/IGS, DWG, DXF, PDF.",
        },
        { status: 400 }
      );
    }
    if (file.size > VYKRESY_MAX_BYTES) {
      return NextResponse.json({ error: "Soubor je větší než 50 MB." }, { status: 400 });
    }

    const mime = (file.type || "application/octet-stream").slice(0, 100);
    const uploadDir = path.join(process.cwd(), "public", "uploads", "vykresy");
    await mkdir(uploadDir, { recursive: true });

    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${ext}`;
    const diskPath = path.join(uploadDir, safeName);
    const webPath = `/uploads/vykresy/${safeName}`;

    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(diskPath, buf);

    const row = await prisma.file_uploads.create({
      data: {
        filename: safeName,
        original_filename: file.name.slice(0, 250),
        file_path: webPath,
        file_size: buf.length,
        mime_type: mime,
        module: VYKRESY_MODULE,
        record_id: vykresId,
        document_type: ext.replace(".", "").slice(0, 30),
        uploaded_by: userId,
        is_public: false,
      },
      include: { users: { select: { first_name: true, last_name: true } } },
    });

    await prisma.vykresy.update({
      where: { id: vykresId },
      data: { updated_at: new Date() },
    });

    return NextResponse.json({ file: row });
  } catch (e) {
    console.error("vykresy files POST:", e);
    return NextResponse.json({ error: "Chyba při nahrávání souboru" }, { status: 500 });
  }
}
