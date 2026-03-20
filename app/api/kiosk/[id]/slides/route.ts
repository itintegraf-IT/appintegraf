import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const presentation = await prisma.presentations.findUnique({
    where: { id },
  });
  if (!presentation) {
    return NextResponse.json({ error: "Prezentace nenalezena" }, { status: 404 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files?.length) {
    return NextResponse.json({ error: "Žádné soubory nebyly vybrány" }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "kiosk");
  await mkdir(uploadDir, { recursive: true });

  const agg = await prisma.slides.aggregate({
    where: { presentation_id: id },
    _max: { sort_order: true },
  });
  const maxOrder = (agg._max.sort_order ?? -1) + 1;

  let sortOrder = maxOrder;
  const created: { id: number }[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!(file instanceof File)) continue;

    const mime = file.type;
    if (!ALLOWED_TYPES.includes(mime)) {
      continue;
    }
    if (file.size > MAX_SIZE) continue;

    const ext = path.extname(file.name) || (mime === "application/pdf" ? ".pdf" : ".jpg");
    const newFilename = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const filePath = path.join(uploadDir, newFilename);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const fileType = mime === "application/pdf" ? "pdf" : "image";
    const webPath = `/uploads/kiosk/${newFilename}`;

    const slide = await prisma.slides.create({
      data: {
        presentation_id: id,
        filename: file.name,
        file_path: webPath,
        file_type: fileType,
        title: null,
        duration: presentation.display_duration,
        transition_effect: presentation.transition_effect ?? "fade",
        visible: true,
        sort_order: sortOrder++,
      },
    });
    created.push({ id: slide.id });
  }

  if (created.length === 0) {
    return NextResponse.json(
      { error: "Nepodařilo se nahrát žádné soubory (JPG, PNG, PDF, max 10 MB)" },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, created });
}
