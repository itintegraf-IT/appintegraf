import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadEquipment } from "@/lib/equipment/access";
import { buildEquipmentLabelsBulkPdf } from "@/lib/equipment/label-pdf";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

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
    return NextResponse.json({ error: "Vyberte položky k tisku" }, { status: 400 });
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: "Najednou lze tisknout nejvýše 500 štítků" }, { status: 400 });
  }

  const items = await prisma.equipment_items.findMany({
    where: { id: { in: ids } },
    include: { equipment_categories: { select: { name: true } } },
  });

  for (const item of items) {
    if (!(await canReadEquipment(userId, item.category_id))) {
      return NextResponse.json({ error: `Nemáte oprávnění k položce ${item.name}` }, { status: 403 });
    }
  }

  const withQr = items.filter((i) => i.qr_code);
  if (withQr.length === 0) {
    return NextResponse.json({ error: "Vybrané položky nemají QR kód" }, { status: 400 });
  }

  const ordered = ids
    .map((id) => withQr.find((i) => i.id === id))
    .filter((i): i is (typeof withQr)[number] => i != null);

  const pdf = await buildEquipmentLabelsBulkPdf(
    ordered.map((item) => ({
      name: item.name,
      asset_tag: item.asset_tag,
      qr_code: item.qr_code as string,
      categoryName: item.equipment_categories.name,
    }))
  );

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="majetek-stitky.pdf"',
    },
  });
}
