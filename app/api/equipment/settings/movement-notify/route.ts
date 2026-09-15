import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAdministerEquipment } from "@/lib/equipment/access";
import {
  getExtraMovementNotifyUserIds,
  setExtraMovementNotifyUserIds,
} from "@/lib/equipment/movement-extra-recipients";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const ids = await getExtraMovementNotifyUserIds();
  const users =
    ids.length === 0
      ? []
      : await prisma.users.findMany({
          where: { id: { in: ids }, is_active: true },
          select: { id: true, first_name: true, last_name: true, email: true },
          orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
        });

  return NextResponse.json({ user_ids: ids, users });
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
  const raw = Array.isArray(body.user_ids) ? body.user_ids : null;
  if (!raw) {
    return NextResponse.json({ error: "Očekáváno pole user_ids" }, { status: 400 });
  }

  const ids = raw
    .map((v: unknown) => (typeof v === "number" ? v : parseInt(String(v), 10)))
    .filter((n: number) => Number.isFinite(n) && n > 0);

  if (ids.length > 0) {
    const existing = await prisma.users.findMany({
      where: { id: { in: ids }, is_active: true },
      select: { id: true },
    });
    const valid = new Set(existing.map((u) => u.id));
    const invalid = ids.filter((id: number) => !valid.has(id));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Neplatní nebo neaktivní uživatelé: ${invalid.join(", ")}` },
        { status: 400 }
      );
    }
  }

  const saved = await setExtraMovementNotifyUserIds(ids, adminId);
  return NextResponse.json({ user_ids: saved });
}
