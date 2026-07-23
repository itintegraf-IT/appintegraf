import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { canAdministerEquipment, canReadEquipment } from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";
import { pdfBufferToJpeg } from "@/lib/iml-product-preview-pdf-server";

async function savePlanImage(
  planId: number,
  file: File
): Promise<{ image_path: string; image_width: number | null; image_height: number | null }> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "equipment", "floor-plans", String(planId));
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
      throw new Error(
        "PDF se nepodařilo převést na obrázek. Nahrajte PNG/JPG, nebo zkontrolujte @napi-rs/canvas."
      );
    }
    outBuf = jpeg;
    ext = ".jpg";
  } else if (mime.includes("png") || file.name.toLowerCase().endsWith(".png")) {
    ext = ".png";
  } else if (mime.includes("webp") || file.name.toLowerCase().endsWith(".webp")) {
    ext = ".webp";
  } else if (mime.includes("jpeg") || mime.includes("jpg") || /\.jpe?g$/i.test(file.name)) {
    ext = ".jpg";
  } else {
    throw new Error("Povolené formáty: PDF, PNG, JPG, WebP");
  }

  if (outBuf.length > 25 * 1024 * 1024) {
    throw new Error("Soubor je větší než 25 MB");
  }

  try {
    const canvasMod = await import("@napi-rs/canvas");
    const img = await canvasMod.loadImage(outBuf);
    width = img.width;
    height = img.height;
  } catch {
    /* dimensions optional */
  }

  const safeName = `plan_${Date.now()}${ext}`;
  const diskPath = path.join(uploadDir, safeName);
  await writeFile(diskPath, outBuf);
  return {
    image_path: `/uploads/equipment/floor-plans/${planId}/${safeName}`,
    image_width: width,
    image_height: height,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const plans = await prisma.equipment_floor_plans.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: "asc" }, { id: "asc" }],
      include: {
        _count: { select: { rooms: true } },
      },
    });
    return NextResponse.json(plans);
  } catch (e) {
    console.error("floor-plans GET:", e);
    const message =
      e && typeof e === "object" && "code" in e && e.code === "P2021"
        ? "Tabulka půdorysů ještě neexistuje – spusťte migraci (npx prisma migrate deploy)."
        : "Chyba při načítání půdorysů";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const name = String(formData.get("name") ?? "").trim();
    const floor_label = String(formData.get("floor_label") ?? "").trim();
    const building = String(formData.get("building") ?? "").trim();
    const sort_order = parseInt(String(formData.get("sort_order") ?? "0"), 10);
    const file = formData.get("file");

    if (!name || !floor_label) {
      return NextResponse.json({ error: "Název a označení patra jsou povinné" }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Nahrajte PDF nebo obrázek půdorysu" }, { status: 400 });
    }

    const plan = await prisma.equipment_floor_plans.create({
      data: {
        name,
        floor_label: floor_label.slice(0, 40),
        building: building || null,
        image_path: "/uploads/equipment/floor-plans/placeholder.jpg",
        sort_order: Number.isFinite(sort_order) ? sort_order : 0,
        created_by: userId,
        is_active: true,
      },
    });

    try {
      const saved = await savePlanImage(plan.id, file);
      const updated = await prisma.equipment_floor_plans.update({
        where: { id: plan.id },
        data: {
          image_path: saved.image_path,
          image_width: saved.image_width,
          image_height: saved.image_height,
          updated_at: new Date(),
        },
      });
      await logEquipmentAuditSafe({
        userId,
        action: "floor_plan_create",
        tableName: "equipment_floor_plans",
        recordId: plan.id,
        detail: { name, floor_label },
      });
      return NextResponse.json(updated, { status: 201 });
    } catch (e) {
      await prisma.equipment_floor_plans.delete({ where: { id: plan.id } }).catch(() => undefined);
      throw e;
    }
  } catch (e) {
    console.error("floor-plans POST:", e);
    if (e && typeof e === "object" && "code" in e && e.code === "P2021") {
      return NextResponse.json(
        { error: "Tabulka půdorysů ještě neexistuje – spusťte migraci." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chyba při vytváření půdorysu" },
      { status: 500 }
    );
  }
}
