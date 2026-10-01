import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadEquipment } from "@/lib/equipment/access";
import type { ScanTarget } from "@/lib/equipment/scan-code";
import { resolveScanCode } from "@/lib/equipment/scan-resolve";

const TARGETS: ScanTarget[] = ["any", "item", "room"];

async function itemPayload(itemId: number, userId: number) {
  const item = await prisma.equipment_items.findUnique({
    where: { id: itemId },
    include: {
      equipment_categories: { select: { id: true, name: true } },
      equipment_rooms: { select: { id: true, name: true, code: true } },
    },
  });
  if (!item || !(await canReadEquipment(userId, item.category_id))) return null;
  return {
    type: "item" as const,
    id: item.id,
    name: item.name,
    asset_tag: item.asset_tag,
    qr_code: item.qr_code,
    category: item.equipment_categories,
    room: item.equipment_rooms,
    purchase_price: item.purchase_price,
    status: item.status,
  };
}

async function roomPayload(roomId: number) {
  const room = await prisma.equipment_rooms.findUnique({ where: { id: roomId } });
  if (!room) return null;
  return {
    type: "room" as const,
    id: room.id,
    name: room.name,
    code: room.code,
    qr_code: room.qr_code,
    building: room.building,
    floor: room.floor,
  };
}

/**
 * Převod kódu ze skeneru / ručního zadání na položku, místnost nebo kód z fondu.
 * `?target=item|room` = co volající čeká; bez něj se u shody položky i místnosti vrátí `ambiguous`.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  const codeParam = req.nextUrl.searchParams.get("code") ?? "";
  if (!codeParam.trim()) {
    return NextResponse.json({ error: "Chybí kód" }, { status: 400 });
  }
  const targetParam = req.nextUrl.searchParams.get("target") ?? "any";
  const target = TARGETS.includes(targetParam as ScanTarget) ? (targetParam as ScanTarget) : "any";

  if (!(await canReadEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const { resolution } = await resolveScanCode(codeParam, target);

    switch (resolution.type) {
      case "item": {
        const item = await itemPayload(resolution.itemId, userId);
        return item
          ? NextResponse.json(item)
          : NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
      }
      case "room": {
        const room = await roomPayload(resolution.roomId);
        return room ? NextResponse.json(room) : NextResponse.json({ error: "Kód nenalezen" }, { status: 404 });
      }
      case "ambiguous": {
        const [item, room] = await Promise.all([
          itemPayload(resolution.itemId, userId),
          roomPayload(resolution.roomId),
        ]);
        // Položku ze skupiny, kterou uživatel nevidí, mu nenabízíme.
        if (item && room) return NextResponse.json({ type: "ambiguous", item, room });
        if (room) return NextResponse.json(room);
        return item ? NextResponse.json(item) : NextResponse.json({ error: "Kód nenalezen" }, { status: 404 });
      }
      case "qr_pool": {
        const pool = await prisma.equipment_qr_pool.findUnique({ where: { id: resolution.poolId } });
        if (!pool) return NextResponse.json({ error: "Kód nenalezen" }, { status: 404 });
        return NextResponse.json({
          type: "qr_pool",
          id: pool.id,
          qr_code: pool.qr_code,
          asset_tag: pool.asset_tag,
          status: pool.status,
          equipment_id: pool.equipment_id,
        });
      }
      case "wrong_kind":
        return NextResponse.json(
          {
            error:
              resolution.found === "room"
                ? "Toto je kód místnosti, ne položky."
                : "Toto je kód položky, ne místnosti.",
          },
          { status: 400 }
        );
      default:
        return NextResponse.json({ error: "Kód nenalezen" }, { status: 404 });
    }
  } catch (e) {
    console.error("equipment lookup:", e);
    return NextResponse.json({ error: "Chyba při hledání kódu" }, { status: 500 });
  }
}
