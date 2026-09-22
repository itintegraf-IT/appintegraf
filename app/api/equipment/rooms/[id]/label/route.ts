import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadEquipment } from "@/lib/equipment/access";
import { buildRoomLabelPdf, buildRoomLabelsBulkPdf } from "@/lib/equipment/label-pdf";

export async function GET(
  req: NextRequest,
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

  const idsParam = req.nextUrl.searchParams.get("ids");
  if (idsParam) {
    const ids = [
      ...new Set(
        idsParam
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n))
      ),
    ].slice(0, 500);
    if (ids.length === 0) {
      return NextResponse.json({ error: "Vyberte místnosti k tisku" }, { status: 400 });
    }
    const rooms = await prisma.equipment_rooms.findMany({
      where: { id: { in: ids } },
    });
    const ordered = ids
      .map((id) => rooms.find((r) => r.id === id))
      .filter((r): r is (typeof rooms)[number] => r != null);
    const pdf = await buildRoomLabelsBulkPdf(
      ordered.map((room) => ({
        name: room.name,
        code: room.code,
        qr_code: room.qr_code,
        building: room.building,
        floor: room.floor,
      }))
    );
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="stitky-mistnosti.pdf"',
      },
    });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const room = await prisma.equipment_rooms.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });

  const pdf = await buildRoomLabelPdf(room);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="mistnost-${room.code}.pdf"`,
    },
  });
}
