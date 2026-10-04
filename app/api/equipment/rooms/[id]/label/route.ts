import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadEquipment } from "@/lib/equipment/access";
import { resolveEquipmentLabelGrid } from "@/lib/equipment/label-grid-settings";
import { labelsPerPage, validateStartPosition } from "@/lib/equipment/label-layout";
import { buildRoomLabelPdf } from "@/lib/equipment/label-pdf";

/** Štítek jedné místnosti na A4 na pozici `?start=N` (výchozí 1). Nic nezapisuje. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { settings, spec } = await resolveEquipmentLabelGrid();
  const start = validateStartPosition(req.nextUrl.searchParams.get("start"), labelsPerPage(spec));
  if (!start.ok) return NextResponse.json({ error: start.error }, { status: 400 });

  const room = await prisma.equipment_rooms.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "Místnost nenalezena" }, { status: 404 });

  const pdf = await buildRoomLabelPdf(room, { spec, ownerText: settings.ownerText, startPosition: start.value });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="mistnost-${room.code}.pdf"`,
      "X-Labels-Ids": String(room.id),
    },
  });
}
