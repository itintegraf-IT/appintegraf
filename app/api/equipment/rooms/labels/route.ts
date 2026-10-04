import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAdministerEquipment } from "@/lib/equipment/access";
import { buildRoomLabelsBulkPdf } from "@/lib/equipment/label-pdf";

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
  const rawIds = Array.isArray((body as { ids?: unknown }).ids)
    ? (body as { ids: unknown[] }).ids
    : [];
  const ids: number[] = [
    ...new Set(
      rawIds
        .map((x) => parseInt(String(x), 10))
        .filter((n): n is number => Number.isFinite(n))
    ),
  ];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Vyberte místnosti k tisku" }, { status: 400 });
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: "Najednou lze tisknout nejvýše 500 štítků" }, { status: 400 });
  }

  const rooms = await prisma.equipment_rooms.findMany({
    where: { id: { in: ids } },
  });
  if (rooms.length === 0) {
    return NextResponse.json({ error: "Místnosti nenalezeny" }, { status: 404 });
  }

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
