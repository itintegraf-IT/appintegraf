import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadEquipment } from "@/lib/equipment/access";
import { buildRoomLabelPdf } from "@/lib/equipment/label-pdf";
import { buildRmPayload } from "@/lib/equipment/qr";

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
    const ids = idsParam
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));
    const rooms = await prisma.equipment_rooms.findMany({
      where: { id: { in: ids } },
    });
    // Reuse pool bulk layout with room payloads via equipment label bulk adapted
    const { setupPdfWithFonts } = await import("@/lib/vyroba/protocol/fonts");
    const { getLabelSlotsOnA4, mmToPt, A4_WIDTH_MM, A4_HEIGHT_MM, LABEL_WIDTH_MM, LABEL_HEIGHT_MM } =
      await import("@/lib/equipment/label-layout");
    const { generateQrPng } = await import("@/lib/equipment/qr");
    const { rgb } = await import("pdf-lib");

    const { doc, font, fontBold } = await setupPdfWithFonts();
    const slots = getLabelSlotsOnA4();
    let slotIdx = 0;
    let page = doc.addPage([mmToPt(A4_WIDTH_MM), mmToPt(A4_HEIGHT_MM)]);

    for (const room of rooms) {
      if (slotIdx >= slots.length) {
        page = doc.addPage([mmToPt(A4_WIDTH_MM), mmToPt(A4_HEIGHT_MM)]);
        slotIdx = 0;
      }
      const slot = slots[slotIdx++];
      const png = await generateQrPng(buildRmPayload(room.qr_code));
      const img = await doc.embedPng(png);
      const w = mmToPt(LABEL_WIDTH_MM);
      const h = mmToPt(LABEL_HEIGHT_MM);
      const pad = mmToPt(3);
      const qrSize = mmToPt(28);
      page.drawRectangle({
        x: slot.x,
        y: slot.y,
        width: w,
        height: h,
        borderColor: rgb(0.2, 0.2, 0.2),
        borderWidth: 0.8,
      });
      page.drawImage(img, {
        x: slot.x + pad,
        y: slot.y + (h - qrSize) / 2,
        width: qrSize,
        height: qrSize,
      });
      const textX = slot.x + pad + qrSize + mmToPt(2);
      page.drawText(room.name.slice(0, 40), {
        x: textX,
        y: slot.y + h - pad - 10,
        size: 8,
        font: fontBold,
      });
      page.drawText(room.code, {
        x: textX,
        y: slot.y + h - pad - 21,
        size: 7,
        font,
      });
    }

    const pdf = await doc.save();
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="stitky-mistnosti.pdf"`,
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
