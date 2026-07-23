import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  canAdministerEquipment,
  canReadEquipment,
  getAccessibleCategoryIds,
} from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const includeInactive = req.nextUrl.searchParams.get("all") === "1";
  const admin = await canAdministerEquipment(userId);

  const categories = await prisma.equipment_categories.findMany({
    where: includeInactive && admin ? undefined : { is_active: true },
    orderBy: { name: "asc" },
    include: {
      users_responsible: {
        select: { id: true, first_name: true, last_name: true },
      },
      _count: { select: { equipment_items: true } },
    },
  });

  const accessible = await getAccessibleCategoryIds(userId);
  const filtered =
    accessible === null
      ? categories
      : categories.filter((c) => accessible.includes(c.id));

  return NextResponse.json(filtered);
}

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
  const name = String(body.name ?? "").trim();
  const code = String(body.code ?? "").trim().toUpperCase();
  if (!name || !code) {
    return NextResponse.json({ error: "Název a kód jsou povinné" }, { status: 400 });
  }

  const existing = await prisma.equipment_categories.findUnique({ where: { code } });
  if (existing) {
    return NextResponse.json({ error: "Kód skupiny už existuje" }, { status: 409 });
  }

  const responsibleId =
    body.responsible_user_id != null && body.responsible_user_id !== ""
      ? parseInt(String(body.responsible_user_id), 10)
      : null;

  const row = await prisma.equipment_categories.create({
    data: {
      name,
      code: code.slice(0, 20),
      description: body.description ? String(body.description).trim() : null,
      icon: body.icon ? String(body.icon).trim() : null,
      is_active: body.is_active !== false,
      responsible_user_id: Number.isFinite(responsibleId as number) ? responsibleId : null,
    },
  });

  await logEquipmentAuditSafe({
    userId,
    action: "category_create",
    tableName: "equipment_categories",
    recordId: row.id,
    detail: { name, code },
  });

  return NextResponse.json(row, { status: 201 });
}
