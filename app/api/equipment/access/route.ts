import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAdministerEquipment } from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const rows = await prisma.equipment_user_category_access.findMany({
    include: {
      users: { select: { id: true, first_name: true, last_name: true, email: true } },
      equipment_categories: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ user_id: "asc" }, { category_id: "asc" }],
  });

  const byUser = new Map<
    number,
    {
      user: { id: number; first_name: string; last_name: string; email: string };
      categories: { id: number; name: string; code: string }[];
    }
  >();

  for (const r of rows) {
    const u = r.users;
    if (!byUser.has(u.id)) {
      byUser.set(u.id, {
        user: {
          id: u.id,
          first_name: u.first_name,
          last_name: u.last_name,
          email: u.email,
        },
        categories: [],
      });
    }
    byUser.get(u.id)!.categories.push(r.equipment_categories);
  }

  return NextResponse.json(Array.from(byUser.values()));
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const adminId = parseInt(session.user.id, 10);
  if (!(await canAdministerEquipment(adminId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const targetUserId = parseInt(String(body.user_id ?? ""), 10);
  const categoryIds: number[] = Array.isArray(body.category_ids)
    ? body.category_ids.map((x: unknown) => parseInt(String(x), 10)).filter((n: number) => Number.isFinite(n))
    : [];

  if (!Number.isFinite(targetUserId)) {
    return NextResponse.json({ error: "Neplatný uživatel" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.equipment_user_category_access.deleteMany({ where: { user_id: targetUserId } });
    if (categoryIds.length > 0) {
      await tx.equipment_user_category_access.createMany({
        data: categoryIds.map((category_id) => ({
          user_id: targetUserId,
          category_id,
          access_level: "read",
          granted_by: adminId,
        })),
      });
    }
  });

  await logEquipmentAuditSafe({
    userId: adminId,
    action: "access_update",
    tableName: "equipment_user_category_access",
    recordId: targetUserId,
    detail: { categoryIds },
  });

  return NextResponse.json({ ok: true, categoryIds });
}
