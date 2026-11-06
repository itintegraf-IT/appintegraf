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
  const applicationId = parseInt((await params).id, 10);
  if (!Number.isFinite(applicationId)) {
    return NextResponse.json({ error: "Neplatné ID." }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const employmentType = normalizeEmploymentType(body.employment_type);
  const startDate = String(body.start_date ?? "").trim() || null;

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, first_name, last_name, email, phone, position_id, position_name, status, notes
     FROM hr_candidate_applications WHERE id = ? LIMIT 1`,
    applicationId
  )) as Array<{
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    position_id: number | null;
    position_name: string | null;
    status: string;
    notes: string | null;
  }>;
  const app = rows[0];
  if (!app) return NextResponse.json({ error: "Uchazeč nebyl nalezen." }, { status: 404 });

  const already = (await prisma.$queryRawUnsafe(
    `SELECT id, user_id FROM hr_employees WHERE application_id = ? LIMIT 1`,
    applicationId
  )) as { id: number; user_id: number }[];
  if (already[0]) {
    return NextResponse.json({
      success: true,
      already_hired: true,
      employee_id: already[0].id,
      user_id: already[0].user_id,
      user_created: false,
      activation_emailed: null,
    });
  }

  try {
    const result = await createEmployeeRecord({
      actorUserId: actorId,
      firstName: app.first_name,
      lastName: app.last_name,
      email: app.email,
      phone: app.phone,
      positionTitle: app.position_name,
      positionId: app.position_id,
      employmentType,
      startDate,
      applicationId: app.id,
      notes: app.notes,
      sendActivationEmail: true,
    });

    await prisma.$executeRawUnsafe(
      `UPDATE hr_candidate_applications SET status = 'accepted' WHERE id = ?`,
      applicationId
    );

    await logPersonalistikaAudit({
      userId: actorId,
      action: "hire:application",
      tableName: "hr_employees",
      recordId: result.employeeId,
      newValues: {
        application_id: applicationId,
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
    const msg = e instanceof Error ? e.message : "Přijetí se nezdařilo.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
