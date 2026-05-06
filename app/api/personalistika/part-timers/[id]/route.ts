import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import {
  ensurePersonalistikaTables,
  normalizePartTimerStatus,
  type PartTimerRow,
} from "@/lib/personalistika-db";
import { logPersonalistikaAudit } from "@/lib/personalistika-audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "personalistika", "read"))) {
    return NextResponse.json({ error: "Nemáte přístup." }, { status: 403 });
  }

  await ensurePersonalistikaTables();
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Neplatné ID." }, { status: 400 });

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, first_name, last_name, phone, email, status, notes, created_at, updated_at
     FROM hr_part_timers WHERE id = ? LIMIT 1`,
    id
  )) as PartTimerRow[];

  if (!rows[0]) return NextResponse.json({ error: "Brigádník nebyl nalezen." }, { status: 404 });
  return NextResponse.json({ partTimer: rows[0] });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "personalistika", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění." }, { status: 403 });
  }

  await ensurePersonalistikaTables();
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Neplatné ID." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim();
  const status = normalizePartTimerStatus(body.status);
  const notes = String(body.notes ?? "").trim();

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Jméno a příjmení jsou povinné." }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Neplatný e-mail." }, { status: 400 });
  }

  const prevRows = (await prisma.$queryRawUnsafe(
    `SELECT first_name, last_name, phone, email, status, notes
     FROM hr_part_timers WHERE id = ? LIMIT 1`,
    id
  )) as Array<Record<string, unknown>>;
  const prev = prevRows[0];
  if (!prev) return NextResponse.json({ error: "Brigádník nebyl nalezen." }, { status: 404 });

  await prisma.$executeRawUnsafe(
    `UPDATE hr_part_timers
     SET first_name = ?, last_name = ?, phone = ?, email = ?, status = ?, notes = ?
     WHERE id = ?`,
    firstName,
    lastName,
    phone || null,
    email || null,
    status,
    notes || null,
    id
  );

  await logPersonalistikaAudit({
    userId,
    action: "update:part_timer",
    tableName: "hr_part_timers",
    recordId: id,
    oldValues: prev,
    newValues: {
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      email: email || null,
      status,
      notes: notes || null,
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "personalistika", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění." }, { status: 403 });
  }

  await ensurePersonalistikaTables();
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Neplatné ID." }, { status: 400 });

  const prevRows = (await prisma.$queryRawUnsafe(
    `SELECT first_name, last_name, phone, email, status, notes
     FROM hr_part_timers WHERE id = ? LIMIT 1`,
    id
  )) as Array<Record<string, unknown>>;
  const prev = prevRows[0];
  if (!prev) return NextResponse.json({ error: "Brigádník nebyl nalezen." }, { status: 404 });

  await prisma.$executeRawUnsafe(`DELETE FROM hr_part_timers WHERE id = ?`, id);

  await logPersonalistikaAudit({
    userId,
    action: "delete:part_timer",
    tableName: "hr_part_timers",
    recordId: id,
    oldValues: prev,
  });

  return NextResponse.json({ success: true });
}
