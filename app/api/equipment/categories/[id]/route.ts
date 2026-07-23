import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAdministerEquipment, canReadEquipment } from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }
  if (!(await canReadEquipment(userId, id))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const row = await prisma.equipment_categories.findUnique({
    where: { id },
    include: {
      users_responsible: {
        select: { id: true, first_name: true, last_name: true },
      },
    },
  });
  if (!row) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.equipment_categories.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: {
    name?: string;
    code?: string;
    description?: string | null;
    icon?: string | null;
    is_active?: boolean;
    responsible_user_id?: number | null;
  } = {};

  if (body.name != null) data.name = String(body.name).trim();
  if (body.code != null) data.code = String(body.code).trim().toUpperCase().slice(0, 20);
  if (body.description !== undefined) {
    data.description = body.description ? String(body.description).trim() : null;
  }
  if (body.icon !== undefined) data.icon = body.icon ? String(body.icon).trim() : null;
  if (body.is_active !== undefined) data.is_active = Boolean(body.is_active);
  if (body.responsible_user_id !== undefined) {
    if (body.responsible_user_id === null || body.responsible_user_id === "") {
      data.responsible_user_id = null;
    } else {
      const rid = parseInt(String(body.responsible_user_id), 10);
      data.responsible_user_id = Number.isFinite(rid) ? rid : null;
    }
  }

  try {
    const row = await prisma.equipment_categories.update({ where: { id }, data });
    await logEquipmentAuditSafe({
      userId,
      action: "category_update",
      tableName: "equipment_categories",
      recordId: id,
      detail: data,
    });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "Chyba při ukládání (duplicitní kód?)" }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.equipment_categories.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }

  const count = await prisma.equipment_items.count({ where: { category_id: id } });
  if (count > 0) {
    return NextResponse.json(
      { error: "Skupinu nelze smazat – obsahuje položky. Deaktivujte ji." },
      { status: 400 }
    );
  }

  // Access rows cascade; items block delete above.
  await prisma.equipment_categories.delete({ where: { id } });

  await logEquipmentAuditSafe({
    userId,
    action: "category_delete",
    tableName: "equipment_categories",
    recordId: id,
    detail: { name: existing.name, code: existing.code },
  });

  return NextResponse.json({ ok: true });
}
