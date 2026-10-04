import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadEquipment } from "@/lib/equipment/access";
import { resolveEquipmentLabelGrid } from "@/lib/equipment/label-grid-settings";
import { labelsPerPage, validateStartPosition } from "@/lib/equipment/label-layout";
import { buildEquipmentLabelPdf } from "@/lib/equipment/label-pdf";

/** Štítek jedné položky na A4 na pozici `?start=N` (výchozí 1). Nic nezapisuje. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const item = await prisma.equipment_items.findUnique({
    where: { id },
    include: { equipment_categories: { select: { name: true } } },
  });
  if (!item || !item.qr_code) {
    return NextResponse.json({ error: "Položka bez QR kódu" }, { status: 404 });
  }
  if (!(await canReadEquipment(userId, item.category_id))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const { settings, spec } = await resolveEquipmentLabelGrid();
  const start = validateStartPosition(req.nextUrl.searchParams.get("start"), labelsPerPage(spec));
  if (!start.ok) return NextResponse.json({ error: start.error }, { status: 400 });

  const pdf = await buildEquipmentLabelPdf(
    {
      name: item.name,
      asset_tag: item.asset_tag,
      qr_code: item.qr_code,
      categoryName: item.equipment_categories.name,
      quantity: item.quantity,
    },
    { spec, ownerText: settings.ownerText, startPosition: start.value }
  );

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="stitek-${item.asset_tag ?? item.id}.pdf"`,
      "X-Labels-Ids": String(item.id),
    },
  });
}
