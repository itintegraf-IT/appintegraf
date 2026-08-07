import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadEquipment, getAccessibleCategoryIds } from "@/lib/equipment/access";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const scope = req.nextUrl.searchParams.get("scope") ?? "all";
  const scopeId = req.nextUrl.searchParams.get("scope_id");
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  const accessible = await getAccessibleCategoryIds(userId);

  const where: Record<string, unknown> = { status: { not: "vyřazeno" } };
  if (accessible !== null) where.category_id = { in: accessible };

  if (scope === "category" && scopeId) {
    const cid = parseInt(scopeId, 10);
    where.category_id =
      accessible === null ? cid : { in: (accessible as number[]).filter((id) => id === cid) };
  } else if (scope === "room" && scopeId) {
    where.room_id = parseInt(scopeId, 10);
  }

  const items = await prisma.equipment_items.findMany({
    where,
    include: {
      equipment_categories: { select: { name: true, code: true } },
      equipment_rooms: { select: { name: true, code: true } },
    },
    orderBy: [{ category_id: "asc" }, { name: "asc" }],
    take: 5000,
  });

  const totalValue = items.reduce((sum, it) => sum + Number(it.purchase_price ?? 0), 0);

  const byCategory = new Map<string, { count: number; value: number }>();
  const byRoom = new Map<string, { count: number; value: number }>();
  for (const it of items) {
    const cn = it.equipment_categories.name;
    const rn = it.equipment_rooms
      ? `${it.equipment_rooms.code} – ${it.equipment_rooms.name}`
      : "(bez místnosti)";
    const v = Number(it.purchase_price ?? 0);
    const c = byCategory.get(cn) ?? { count: 0, value: 0 };
    c.count++;
    c.value += v;
    byCategory.set(cn, c);
    const r = byRoom.get(rn) ?? { count: 0, value: 0 };
    r.count++;
    r.value += v;
    byRoom.set(rn, r);
  }

  if (format === "csv") {
    const header = [
      "asset_tag",
      "name",
      "category",
      "room",
      "status",
      "purchase_price",
      "serial_number",
    ];
    const lines = [
      header.join(";"),
      ...items.map((it) =>
        [
          it.asset_tag ?? "",
          `"${it.name.replace(/"/g, '""')}"`,
          it.equipment_categories.name,
          it.equipment_rooms?.code ?? "",
          it.status ?? "",
          it.purchase_price ?? "",
          it.serial_number ?? "",
        ].join(";")
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="majetek-sestava.csv"',
      },
    });
  }

  // dashboard-ish summary
  const warrantySoon = await prisma.equipment_items.count({
    where: {
      ...where,
      warranty_until: {
        gte: new Date(),
        lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    },
  });
  const withoutRoom = await prisma.equipment_items.count({
    where: { ...where, room_id: null },
  });

  return NextResponse.json({
    count: items.length,
    totalValue,
    byCategory: Object.fromEntries(byCategory),
    byRoom: Object.fromEntries(byRoom),
    warrantySoon,
    withoutRoom,
    items: format === "full" ? items : undefined,
  });
}
