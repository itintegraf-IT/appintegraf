import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import {
  ensurePersonalistikaTables,
  normalizeEmploymentType,
} from "@/lib/personalistika-db";
import { logPersonalistikaAudit } from "@/lib/personalistika-audit";
import { createEmployeeRecord } from "@/lib/personalistika-employees";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const actorId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(actorId, "personalistika", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění." }, { status: 403 });
  }

  await ensurePersonalistikaTables();
  const partTimerId = parseInt((await params).id, 10);
  if (!Number.isFinite(partTimerId)) {
    return NextResponse.json({ error: "Neplatné ID." }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const employmentType = normalizeEmploymentType(body.employment_type);
  const startDate = String(body.start_date ?? "").trim() || null;

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, first_name, last_name, email, phone, notes, position_id, status
     FROM hr_part_timers WHERE id = ? LIMIT 1`,
    partTimerId
  )) as Array<{
    id: number;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
    position_id: number | null;
    status: string;
  }>;
  const pt = rows[0];
  if (!pt) return NextResponse.json({ error: "Brigádník nebyl nalezen." }, { status: 404 });
  if (!pt.email?.trim()) {
    return NextResponse.json(
      { error: "Pro převod na zaměstnance je potřeba e-mail." },
      { status: 400 }
    );
  }

  try {
    const result = await createEmployeeRecord({
      actorUserId: actorId,
      firstName: pt.first_name,
      lastName: pt.last_name,
      email: pt.email,
      phone: pt.phone,
      positionId: pt.position_id,
      employmentType,
      startDate,
      notes: pt.notes
        ? `Převod z brigádníka #${pt.id}. ${pt.notes}`
        : `Převod z brigádníka #${pt.id}.`,
      sendActivationEmail: true,
    });

    await prisma.$executeRawUnsafe(
      `UPDATE hr_part_timers SET status = 'zamestnany', notes = CONCAT(COALESCE(notes, ''), ?) WHERE id = ?`,
      `\n[Převod ${new Date().toISOString().slice(0, 10)}] Zaměstnanec #${result.employeeId}`,
      partTimerId
    );

    await logPersonalistikaAudit({
      userId: actorId,
      action: "hire:part_timer",
      tableName: "hr_employees",
      recordId: result.employeeId,
      newValues: {
        part_timer_id: partTimerId,
        employee_id: result.employeeId,
        user_id: result.userId,
        user_created: result.userCreated,
        activation_emailed: result.activationEmailed,
        employment_type: employmentType,
      },
    });

    return NextResponse.json({
      success: true,
      employee_id: result.employeeId,
      user_id: result.userId,
      user_created: result.userCreated,
      activation_emailed: result.activationEmailed,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Převod se nezdařil.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
