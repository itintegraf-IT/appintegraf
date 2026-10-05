import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadEquipment } from "@/lib/equipment/access";
import { resolveEquipmentLabelGrid } from "@/lib/equipment/label-grid-settings";
import { labelsPerPage, validateStartPosition } from "@/lib/equipment/label-layout";
import { buildRoomLabelsBulkPdf } from "@/lib/equipment/label-pdf";
import { parseLabelIds, sortRoomsForLabels } from "@/lib/equipment/label-plan";
import { labelPrintBlockedReason } from "@/lib/equipment/qr";

/**
 * Štítky vybraných místností jako PDF (A4, uložená mřížka, od zvolené pozice).
 * Nic nezapisuje — vytištění potvrzuje správa evidence zvlášť.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }
  const blocked = labelPrintBlockedReason();
  if (blocked) return NextResponse.json({ error: blocked }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; startPosition?: unknown };
  const parsedIds = parseLabelIds(body.ids);
  if (!parsedIds.ok) return NextResponse.json({ error: parsedIds.error }, { status: 400 });

  const { settings, spec } = await resolveEquipmentLabelGrid();
  const start = validateStartPosition(body.startPosition, labelsPerPage(spec));
  if (!start.ok) return NextResponse.json({ error: start.error }, { status: 400 });

  const rooms = await prisma.equipment_rooms.findMany({ where: { id: { in: parsedIds.ids } } });
  if (rooms.length === 0) {
    return NextResponse.json({ error: "Místnosti nenalezeny" }, { status: 404 });
  }
  const sorted = sortRoomsForLabels(rooms);

  const pdf = await buildRoomLabelsBulkPdf(
    sorted.map((room) => ({
      name: room.name,
      code: room.code,
      qr_code: room.qr_code,
      building: room.building,
      floor: room.floor,
    })),
    { spec, ownerText: settings.ownerText, startPosition: start.value }
  );

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="stitky-mistnosti.pdf"',
      "X-Labels-Skipped": String(parsedIds.ids.length - rooms.length),
      "X-Labels-Count": String(sorted.length),
    },
  });
}
