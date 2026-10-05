import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadEquipment } from "@/lib/equipment/access";
import { resolveEquipmentLabelGrid } from "@/lib/equipment/label-grid-settings";
import { labelsPerPage, validateStartPosition } from "@/lib/equipment/label-layout";
import { buildEquipmentLabelsBulkPdf } from "@/lib/equipment/label-pdf";
import { parseLabelIds, sortItemsForLabels, splitPrintable } from "@/lib/equipment/label-plan";
import { labelPrintBlockedReason } from "@/lib/equipment/qr";

/**
 * Štítky vybraných položek jako PDF (A4, od zvolené pozice). Nic nezapisuje —
 * vytištění potvrzuje uživatel zvlášť (`/api/equipment/labels/confirm`).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; startPosition?: unknown };
  const parsedIds = parseLabelIds(body.ids);
  if (!parsedIds.ok) return NextResponse.json({ error: parsedIds.error }, { status: 400 });

  const { settings, spec } = await resolveEquipmentLabelGrid();
  const start = validateStartPosition(body.startPosition, labelsPerPage(spec));
  if (!start.ok) return NextResponse.json({ error: start.error }, { status: 400 });

  const items = await prisma.equipment_items.findMany({
    where: { id: { in: parsedIds.ids } },
    include: {
      equipment_categories: { select: { name: true } },
      equipment_rooms: { select: { name: true } },
    },
  });

  for (const categoryId of new Set(items.map((i) => i.category_id))) {
    if (!(await canReadEquipment(userId, categoryId))) {
      return NextResponse.json({ error: "Nemáte oprávnění ke všem vybraným položkám" }, { status: 403 });
    }
  }
  const blocked = labelPrintBlockedReason();
  if (blocked) return NextResponse.json({ error: blocked }, { status: 503 });

  const { printable, skipped } = splitPrintable(items);
  if (printable.length === 0) {
    return NextResponse.json({ error: "Vybrané položky nemají QR kód" }, { status: 400 });
  }
  const sorted = sortItemsForLabels(
    printable.map((item) => ({ ...item, roomName: item.equipment_rooms?.name ?? null, assetTag: item.asset_tag }))
  );

  const pdf = await buildEquipmentLabelsBulkPdf(
    sorted.map((item) => ({
      name: item.name,
      asset_tag: item.asset_tag,
      qr_code: item.qr_code as string,
      categoryName: item.equipment_categories.name,
      quantity: item.quantity,
    })),
    { spec, ownerText: settings.ownerText, startPosition: start.value }
  );

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="majetek-stitky.pdf"',
      "X-Labels-Skipped": String(skipped.length + (parsedIds.ids.length - items.length)),
      "X-Labels-Count": String(sorted.length),
    },
  });
}
