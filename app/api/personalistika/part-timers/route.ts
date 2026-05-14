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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "personalistika", "read"))) {
    return NextResponse.json({ error: "Nemáte přístup k modulu Personalistika." }, { status: 403 });
  }

  await ensurePersonalistikaTables();

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") ?? "").trim();

  const params: unknown[] = [];
  let whereSql = "";
  if (q) {
    whereSql = `WHERE (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, first_name, last_name, phone, email, status, notes, created_at, updated_at
     FROM hr_part_timers
     ${whereSql}
     ORDER BY last_name ASC, first_name ASC
     LIMIT 500`,
    ...params
  )) as PartTimerRow[];

  return NextResponse.json({ partTimers: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "personalistika", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění přidávat brigádníky." }, { status: 403 });
  }

  await ensurePersonalistikaTables();

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

  await prisma.$executeRawUnsafe(
    `INSERT INTO hr_part_timers (first_name, last_name, phone, email, status, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    firstName,
    lastName,
    phone || null,
    email || null,
    status,
    notes || null
  );

  const createdRows = (await prisma.$queryRawUnsafe(
    `SELECT id FROM hr_part_timers
     WHERE first_name = ? AND last_name = ?
     ORDER BY id DESC LIMIT 1`,
    firstName,
    lastName
  )) as { id: number }[];
  const recordId = createdRows[0]?.id ?? 0;

  if (recordId > 0) {
    await logPersonalistikaAudit({
      userId,
      action: "create:part_timer",
      tableName: "hr_part_timers",
      recordId,
      newValues: {
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        email: email || null,
        status,
        notes: notes || null,
      },
    });
  }

  return NextResponse.json({ success: true, id: recordId });
}
