import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import {
  extensionForKioskMime,
  kioskFileTypeFromMime,
  kioskUploadRejectMessage,
  validateKioskFile,
  type KioskFileRejectReason,
} from "@/lib/kiosk/upload";
import { verifyKioskFileOnDisk } from "@/lib/kiosk/files";

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
  const rejectReasons: KioskFileRejectReason[] = [];
  let writeFailed = false;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!(file instanceof File)) continue;

    const check = validateKioskFile(file);
    if (!check.ok) {
      rejectReasons.push(check.reason);
      continue;
    }

    const ext = extensionForKioskMime(check.mime, file.name);
    const newFilename = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const filePath = path.join(uploadDir, newFilename);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    if (!(await verifyKioskFileOnDisk(filePath))) {
      writeFailed = true;
      try {
        await unlink(filePath);
      } catch {
        /* ignore */
      }
      continue;
    }

    const webPath = `/uploads/kiosk/${newFilename}`;

    const slide = await prisma.slides.create({
      data: {
        presentation_id: id,
        filename: file.name,
        file_path: webPath,
        file_type: kioskFileTypeFromMime(check.mime),
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
      {
        error: writeFailed
          ? "Soubor se nepodařilo uložit na disk"
          : kioskUploadRejectMessage(rejectReasons),
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, created });
}
