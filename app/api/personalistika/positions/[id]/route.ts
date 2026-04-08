import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { ensurePersonalistikaTables } from "@/lib/personalistika-db";
import { logPersonalistikaAudit } from "@/lib/personalistika-audit";

async function getAuthorizedUserId(): Promise<number | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = parseInt(session.user.id, 10);
  const canWrite = await hasModuleAccess(userId, "personalistika", "write");
  if (!canWrite) return null;
  return userId;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthorizedUserId();
  if (!userId) return NextResponse.json({ error: "Nemáte oprávnění." }, { status: 403 });

  await ensurePersonalistikaTables();
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Neplatné ID." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const name = String((body as Record<string, unknown>).name ?? "").trim();
  const isActive = (body as Record<string, unknown>).is_active !== false ? 1 : 0;
  if (!name) return NextResponse.json({ error: "Název pozice je povinný." }, { status: 400 });

  const prevRows = (await prisma.$queryRawUnsafe(
    `SELECT id, name, is_active FROM hr_positions WHERE id = ? LIMIT 1`,
    id
  )) as { id: number; name: string; is_active: number }[];
  const prev = prevRows[0];
  if (!prev) return NextResponse.json({ error: "Pozice nebyla nalezena." }, { status: 404 });

  await prisma.$executeRawUnsafe(`UPDATE hr_positions SET name = ?, is_active = ? WHERE id = ?`, name, isActive, id);
  await logPersonalistikaAudit({
    userId,
    action: "update:position",
    tableName: "hr_positions",
    recordId: id,
    oldValues: { name: prev.name, is_active: prev.is_active },
    newValues: { name, is_active: isActive },
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthorizedUserId();
  if (!userId) return NextResponse.json({ error: "Nemáte oprávnění." }, { status: 403 });

  await ensurePersonalistikaTables();
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Neplatné ID." }, { status: 400 });

  const prevRows = (await prisma.$queryRawUnsafe(
    `SELECT id, name, is_active FROM hr_positions WHERE id = ? LIMIT 1`,
    id
  )) as { id: number; name: string; is_active: number }[];
  const prev = prevRows[0];
  if (!prev) return NextResponse.json({ error: "Pozice nebyla nalezena." }, { status: 404 });

  await prisma.$executeRawUnsafe(`DELETE FROM hr_positions WHERE id = ?`, id);
  await logPersonalistikaAudit({
    userId,
    action: "delete:position",
    tableName: "hr_positions",
    recordId: id,
    oldValues: { name: prev.name, is_active: prev.is_active },
  });
  return NextResponse.json({ success: true });
}
