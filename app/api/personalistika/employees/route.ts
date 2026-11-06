import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import {
  ensurePersonalistikaTables,
  normalizeEmployeeStatus,
  normalizeEmploymentType,
  parseChecklistJson,
  serializeChecklistJson,
  type EmployeeRow,
} from "@/lib/personalistika-db";
import { logPersonalistikaAudit } from "@/lib/personalistika-audit";
import {
  ensureEmployeeUser,
  mergeChecklistInput,
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
  return {
    ...row,
    onboarding: parseChecklistJson(row.onboarding_json),
    offboarding: parseChecklistJson(row.offboarding_json),
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

  // Jednorázový bootstrap: když je evidence prázdná, naplní se z aktivních users.
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

  const params: unknown[] = [];
  const where: string[] = [];
  if (q) {
    where.push(`(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ? OR position_title LIKE ?)`);
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
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT *
     FROM hr_employees
     ${whereSql}
     ORDER BY status ASC, last_name ASC, first_name ASC
     LIMIT 500`,
    ...params
  )) as EmployeeRow[];

  return NextResponse.json({
    employees: rows.map(mapEmployee),
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
  const departmentIdRaw = body.department_id;
  const departmentId =
    departmentIdRaw === null || departmentIdRaw === "" || departmentIdRaw === undefined
      ? null
      : Number(departmentIdRaw);
  const employmentType = normalizeEmploymentType(body.employment_type);
  const startDate = toIsoDate(body.start_date);
  const endDate = toIsoDate(body.end_date);
  let status = normalizeEmployeeStatus(body.status);
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
  if (endDate) status = "terminated";

  try {
    const { userId, created: userCreated } = await ensureEmployeeUser({
      email,
      firstName,
      lastName,
      phone,
      personalPhone,
      personalEmail,
      positionTitle,
      departmentId: Number.isFinite(departmentId as number) ? (departmentId as number) : null,
    });

    const existingEmp = (await prisma.$queryRawUnsafe(
      `SELECT id FROM hr_employees WHERE user_id = ? LIMIT 1`,
      userId
    )) as { id: number }[];
    if (existingEmp[0]) {
      return NextResponse.json(
        { error: "Pro tohoto uživatele už evidence zaměstnance existuje.", id: existingEmp[0].id },
        { status: 409 }
      );
    }

    const onboarding = mergeChecklistInput(body.onboarding, {}, actorId);
    const offboarding = mergeChecklistInput(body.offboarding, {}, actorId);

    await prisma.$executeRawUnsafe(
      `INSERT INTO hr_employees (
        user_id, application_id, first_name, last_name, email, phone, personal_phone, personal_email,
        position_title, department_id, employment_type, start_date, end_date, status, notes,
        onboarding_json, offboarding_json, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      userId,
      Number.isFinite(applicationId as number) ? applicationId : null,
      firstName,
      lastName,
      email,
      phone || null,
      personalPhone || null,
      personalEmail || null,
      positionTitle || null,
      Number.isFinite(departmentId as number) ? departmentId : null,
      employmentType,
      startDate,
      endDate,
      status,
      notes || null,
      serializeChecklistJson(onboarding),
      serializeChecklistJson(offboarding),
      actorId,
      actorId
    );

    const createdRows = (await prisma.$queryRawUnsafe(
      `SELECT * FROM hr_employees WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
      userId
    )) as EmployeeRow[];
    const created = createdRows[0];
    if (!created) {
      return NextResponse.json({ error: "Zaměstnance se nepodařilo vytvořit." }, { status: 500 });
    }

    if (status === "terminated") {
      await prisma.users.update({
        where: { id: userId },
        data: { is_active: false, display_in_list: false },
      });
    }

    await logPersonalistikaAudit({
      userId: actorId,
      action: "create:employee",
      tableName: "hr_employees",
      recordId: created.id,
      newValues: {
        ...mapEmployee(created),
        user_created: userCreated,
      },
    });

    return NextResponse.json({
      success: true,
      id: created.id,
      user_id: userId,
      user_created: userCreated,
      employee: mapEmployee(created),
    });
  } catch (e) {
    console.error("Employees POST error:", e);
    const msg = e instanceof Error ? e.message : "Chyba při vytváření zaměstnance.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
