import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import {
  ensurePersonalistikaTables,
  normalizeEmployeeStatus,
  normalizeEmploymentType,
  parseChecklistJson,
  type EmployeeRow,
} from "@/lib/personalistika-db";
import { logPersonalistikaAudit } from "@/lib/personalistika-audit";
import {
  computeOnboardingProgress,
  createEmployeeRecord,
  syncEmployeesFromActiveUsers,
} from "@/lib/personalistika-employees";

function toIsoDate(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function mapEmployee(row: EmployeeRow) {
  const onboarding = parseChecklistJson(row.onboarding_json);
  const progress = computeOnboardingProgress(onboarding);
  return {
    ...row,
    onboarding,
    offboarding: parseChecklistJson(row.offboarding_json),
    onboarding_progress: progress,
    start_date: row.start_date
      ? typeof row.start_date === "string"
        ? row.start_date.slice(0, 10)
        : row.start_date.toISOString().slice(0, 10)
      : null,
    end_date: row.end_date
      ? typeof row.end_date === "string"
        ? row.end_date.slice(0, 10)
        : row.end_date.toISOString().slice(0, 10)
      : null,
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "personalistika", "read"))) {
    return NextResponse.json({ error: "Nemáte přístup k modulu Personalistika." }, { status: 403 });
  }

  await ensurePersonalistikaTables();

  let bootstrap: { created: number; skipped: number } | null = null;
  const countRows = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt FROM hr_employees`
  )) as { cnt: number | bigint }[];
  const total = Number(countRows[0]?.cnt ?? 0);
  if (total === 0 && (await hasModuleAccess(userId, "personalistika", "write"))) {
    bootstrap = await syncEmployeesFromActiveUsers(userId);
    await logPersonalistikaAudit({
      userId,
      action: "sync:employees_from_users_bootstrap",
      tableName: "hr_employees",
      recordId: 0,
      newValues: bootstrap,
    });
  }

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") ?? "").trim();
  const status = String(searchParams.get("status") ?? "").trim();
  const employmentType = String(searchParams.get("employment_type") ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") ?? "50", 10) || 50));
  const offset = (page - 1) * pageSize;

  const params: unknown[] = [];
  const where: string[] = [];
  if (q) {
    where.push(
      `(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ? OR position_title LIKE ?)`
    );
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  if (status === "active" || status === "terminated") {
    where.push(`status = ?`);
    params.push(status);
  }
  if (employmentType === "thp" || employmentType === "delnik") {
    where.push(`employment_type = ?`);
    params.push(employmentType);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const countFiltered = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt FROM hr_employees ${whereSql}`,
    ...params
  )) as { cnt: number | bigint }[];
  const totalFiltered = Number(countFiltered[0]?.cnt ?? 0);

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT *
     FROM hr_employees
     ${whereSql}
     ORDER BY status ASC, last_name ASC, first_name ASC
     LIMIT ${pageSize} OFFSET ${offset}`,
    ...params
  )) as EmployeeRow[];

  return NextResponse.json({
    employees: rows.map(mapEmployee),
    pagination: { page, pageSize, total: totalFiltered },
    ...(bootstrap ? { bootstrap } : {}),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const actorId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(actorId, "personalistika", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění přidávat zaměstnance." }, { status: 403 });
  }

  await ensurePersonalistikaTables();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  const personalPhone = String(body.personal_phone ?? "").trim();
  const personalEmail = String(body.personal_email ?? "").trim();
  const positionTitle = String(body.position_title ?? "").trim();
  const positionIdRaw = body.position_id;
  const positionId =
    positionIdRaw === null || positionIdRaw === "" || positionIdRaw === undefined
      ? null
      : Number(positionIdRaw);
  const departmentIdRaw = body.department_id;
  const departmentId =
    departmentIdRaw === null || departmentIdRaw === "" || departmentIdRaw === undefined
      ? null
      : Number(departmentIdRaw);
  const employmentType = normalizeEmploymentType(body.employment_type);
  const startDate = toIsoDate(body.start_date);
  const notes = String(body.notes ?? "").trim();
  const applicationIdRaw = body.application_id;
  const applicationId =
    applicationIdRaw === null || applicationIdRaw === "" || applicationIdRaw === undefined
      ? null
      : Number(applicationIdRaw);

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Jméno a příjmení jsou povinné." }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Platný e-mail je povinný." }, { status: 400 });
  }
  if (personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
    return NextResponse.json({ error: "Neplatný osobní e-mail." }, { status: 400 });
  }

  try {
    const result = await createEmployeeRecord({
      actorUserId: actorId,
      firstName,
      lastName,
      email,
      phone,
      personalPhone,
      personalEmail,
      positionTitle,
      positionId: Number.isFinite(positionId as number) ? (positionId as number) : null,
      departmentId: Number.isFinite(departmentId as number) ? (departmentId as number) : null,
      employmentType,
      startDate,
      applicationId: Number.isFinite(applicationId as number) ? (applicationId as number) : null,
      notes,
      sendActivationEmail: true,
    });

    const createdRows = (await prisma.$queryRawUnsafe(
      `SELECT * FROM hr_employees WHERE id = ? LIMIT 1`,
      result.employeeId
    )) as EmployeeRow[];
    const created = createdRows[0];

    await logPersonalistikaAudit({
      userId: actorId,
      action: "create:employee",
      tableName: "hr_employees",
      recordId: result.employeeId,
      newValues: {
        ...(created ? mapEmployee(created) : {}),
        user_created: result.userCreated,
        activation_emailed: result.activationEmailed,
      },
    });

    return NextResponse.json({
      success: true,
      id: result.employeeId,
      user_id: result.userId,
      user_created: result.userCreated,
      activation_emailed: result.activationEmailed,
      employee: created ? mapEmployee(created) : null,
    });
  } catch (e) {
    console.error("Employees POST error:", e);
    const msg = e instanceof Error ? e.message : "Chyba při vytváření zaměstnance.";
    const status = msg.includes("už") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
