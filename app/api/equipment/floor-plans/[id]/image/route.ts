import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { canAdministerEquipment } from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";
import { pdfBufferToJpeg } from "@/lib/iml-product-preview-pdf-server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.equipment_floor_plans.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Vyberte soubor" }, { status: 400 });
    }

    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "equipment",
      "floor-plans",
      String(id)
    );
    await mkdir(uploadDir, { recursive: true });

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = (file.type || "").toLowerCase();
    const isPdf =
      mime === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf") ||
      (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46);

    let outBuf: Buffer = buf;
    let ext = ".jpg";
    let width: number | null = null;
    let height: number | null = null;

    if (isPdf) {
      const jpeg = await pdfBufferToJpeg(buf, { maxSide: 2800, jpegQuality: 0.92 });
      if (!jpeg) {
        return NextResponse.json(
          { error: "PDF se nepodařilo převést. Zkuste PNG/JPG." },
          { status: 400 }
        );
      }
      outBuf = jpeg;
    } else if (mime.includes("png") || file.name.toLowerCase().endsWith(".png")) {
      ext = ".png";
    } else if (mime.includes("webp") || file.name.toLowerCase().endsWith(".webp")) {
      ext = ".webp";
    } else if (
      mime.includes("jpeg") ||
      mime.includes("jpg") ||
      /\.jpe?g$/i.test(file.name)
    ) {
      ext = ".jpg";
    } else {
      return NextResponse.json({ error: "Povolené: PDF, PNG, JPG, WebP" }, { status: 400 });
    }

    try {
      const canvasMod = await import("@napi-rs/canvas");
      const img = await canvasMod.loadImage(outBuf);
      width = img.width;
      height = img.height;
    } catch {
      /* optional */
    }

    const safeName = `plan_${Date.now()}${ext}`;
    await writeFile(path.join(uploadDir, safeName), outBuf);
    const image_path = `/uploads/equipment/floor-plans/${id}/${safeName}`;

    const row = await prisma.equipment_floor_plans.update({
      where: { id },
      data: {
        image_path,
        image_width: width,
        image_height: height,
        updated_at: new Date(),
      },
    });

    await logEquipmentAuditSafe({
      userId,
      action: "floor_plan_image",
      tableName: "equipment_floor_plans",
      recordId: id,
    });

    return NextResponse.json(row);
  } catch (e) {
    console.error("floor-plans image POST:", e);
    return NextResponse.json({ error: "Chyba při nahrávání" }, { status: 500 });
  }
}
