import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAdministerEquipment, canReadEquipment } from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";
import { generateUniqueRmQrCode } from "@/lib/equipment/qr";
import {
  defaultPlanColor,
  parseRoomPolygon,
  serializeRoomPolygon,
} from "@/lib/equipment/floor-plan";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const all = req.nextUrl.searchParams.get("all") === "1";
  try {
    const rooms = await prisma.equipment_rooms.findMany({
      where: all ? undefined : { is_active: true },
      orderBy: [{ building: "asc" }, { code: "asc" }],
      include: { _count: { select: { equipment_items: true } } },
    });
    return NextResponse.json(rooms);
  } catch (e) {
    console.error("equipment/rooms GET:", e);
    const message =
      e && typeof e === "object" && "code" in e && e.code === "P2021"
        ? "Tabulka místností ještě neexistuje – spusťte migraci databáze (npx prisma migrate deploy)."
        : "Chyba při načítání místností";
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

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const code = String(body.code ?? "").trim().toUpperCase();
  if (!name || !code) {
    return NextResponse.json({ error: "Název a kód jsou povinné" }, { status: 400 });
  }

  try {
    const qr_code = await generateUniqueRmQrCode();
    const polygon = body.polygon != null ? parseRoomPolygon(body.polygon) : null;
    const floorPlanId =
      body.floor_plan_id != null && body.floor_plan_id !== ""
        ? parseInt(String(body.floor_plan_id), 10)
        : null;

    const row = await prisma.equipment_rooms.create({
      data: {
        name,
        code: code.slice(0, 40),
        building: body.building ? String(body.building).trim() : null,
        floor: body.floor ? String(body.floor).trim() : null,
        description: body.description ? String(body.description).trim() : null,
        qr_code,
        is_active: true,
        floor_plan_id: Number.isFinite(floorPlanId as number) ? floorPlanId : null,
        polygon_json: polygon ? serializeRoomPolygon(polygon) : null,
        plan_color: body.plan_color
          ? String(body.plan_color).trim().slice(0, 20)
          : defaultPlanColor(code),
      },
    });
    await logEquipmentAuditSafe({
      userId,
      action: "room_create",
      tableName: "equipment_rooms",
      recordId: row.id,
      detail: { name, code, qr_code, floor_plan_id: row.floor_plan_id },
    });
    return NextResponse.json(
      { ...row, polygon: parseRoomPolygon(row.polygon_json) },
      { status: 201 }
    );
  } catch (e) {
    console.error("equipment/rooms POST:", e);
    if (e && typeof e === "object" && "code" in e) {
      if (e.code === "P2021") {
        return NextResponse.json(
          {
            error:
              "Tabulka místností ještě neexistuje – spusťte migraci databáze (npx prisma migrate deploy).",
          },
          { status: 503 }
        );
      }
      if (e.code === "P2002") {
        return NextResponse.json({ error: "Kód místnosti už existuje" }, { status: 409 });
      }
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chyba při vytváření místnosti" },
      { status: 500 }
    );
  }
}
