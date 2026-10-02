import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import { canAdministerEquipment, canReadEquipment } from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";
import {
  floorPlanImageContentType,
  floorPlanImageDiskPath,
} from "@/lib/equipment/floor-plan-storage";
import { FloorPlanUploadError, saveFloorPlanUpload } from "@/lib/equipment/floor-plan-upload";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const plan = await prisma.equipment_floor_plans.findUnique({ where: { id } });
  if (!plan || !plan.is_active) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }

  const diskPath = floorPlanImageDiskPath(plan.image_path);
  if (!diskPath) {
    return NextResponse.json(
      { error: "Neplatná cesta k obrázku půdorysu" },
      { status: 404 }
    );
  }

  try {
    const buf = await readFile(diskPath);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": floorPlanImageContentType(plan.image_path),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Soubor půdorysu na disku chybí. Nahrajte obrázek znovu (Vyměnit obrázek).",
        image_path: plan.image_path,
      },
      { status: 404 }
    );
  }
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

    const saved = await saveFloorPlanUpload(id, file);

    const row = await prisma.equipment_floor_plans.update({
      where: { id },
      data: {
        image_path: saved.image_path,
        image_width: saved.image_width,
        image_height: saved.image_height,
        updated_at: new Date(),
      },
    });

    await logEquipmentAuditSafe({
      userId,
      action: "floor_plan_image",
      tableName: "equipment_floor_plans",
      recordId: id,
      oldValues: { image_path: existing.image_path },
      detail: { image_path: saved.image_path },
    });

    return NextResponse.json(row);
  } catch (e) {
    console.error("floor-plans image POST:", e);
    if (e instanceof FloorPlanUploadError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Chyba při nahrávání plánku" }, { status: 500 });
  }
}
