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
  listActiveEquipmentForUser,
  mergeChecklistInput,
  syncEmployeeToUser,
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

async function loadEmployee(id: number): Promise<EmployeeRow | null> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT * FROM hr_employees WHERE id = ? LIMIT 1`,
    id
  )) as EmployeeRow[];
  return rows[0] ?? null;
}

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

  const row = await loadEmployee(id);
  if (!row) return NextResponse.json({ error: "Zaměstnanec nebyl nalezen." }, { status: 404 });

  const equipment = await listActiveEquipmentForUser(row.user_id);
  return NextResponse.json({ employee: mapEmployee(row), equipment });
}

export async function PATCH(
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
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Neplatné ID." }, { status: 400 });

  const prev = await loadEmployee(id);
  if (!prev) return NextResponse.json({ error: "Zaměstnanec nebyl nalezen." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const firstName = String(body.first_name ?? prev.first_name).trim();
  const lastName = String(body.last_name ?? prev.last_name).trim();
  const email = String(body.email ?? prev.email).trim().toLowerCase();
  const phone = String(body.phone ?? prev.phone ?? "").trim();
  const personalPhone = String(body.personal_phone ?? prev.personal_phone ?? "").trim();
  const personalEmail = String(body.personal_email ?? prev.personal_email ?? "").trim();
  let positionTitle = String(body.position_title ?? prev.position_title ?? "").trim();
  const positionIdRaw = body.position_id !== undefined ? body.position_id : prev.position_id;
  const positionId =
    positionIdRaw === null || positionIdRaw === "" || positionIdRaw === undefined
      ? null
      : Number(positionIdRaw);
  if (Number.isFinite(positionId as number) && positionId) {
    const posRows = (await prisma.$queryRawUnsafe(
      `SELECT name FROM hr_positions WHERE id = ? LIMIT 1`,
      positionId
    )) as { name: string }[];
    if (posRows[0]?.name) positionTitle = posRows[0].name;
  }
  const departmentIdRaw = body.department_id !== undefined ? body.department_id : prev.department_id;
  const departmentId =
    departmentIdRaw === null || departmentIdRaw === "" || departmentIdRaw === undefined
      ? null
      : Number(departmentIdRaw);
  const employmentType = normalizeEmploymentType(body.employment_type ?? prev.employment_type);
  const startDate = body.start_date !== undefined ? toIsoDate(body.start_date) : toIsoDate(prev.start_date);
  const endDate = body.end_date !== undefined ? toIsoDate(body.end_date) : toIsoDate(prev.end_date);
  let status = normalizeEmployeeStatus(body.status ?? prev.status);
  const notes = String(body.notes ?? prev.notes ?? "").trim();

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Jméno a příjmení jsou povinné." }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Platný e-mail je povinný." }, { status: 400 });
  }
  if (personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
    return NextResponse.json({ error: "Neplatný osobní e-mail." }, { status: 400 });
  }
  if (endDate || status === "terminated") {
    status = "terminated";
  }

  const onboarding = mergeChecklistInput(
    body.onboarding,
    parseChecklistJson(prev.onboarding_json),
    actorId
  );
  const offboarding = mergeChecklistInput(
    body.offboarding,
    parseChecklistJson(prev.offboarding_json),
    actorId
  );

  try {
    await syncEmployeeToUser({
      userId: prev.user_id,
      firstName,
      lastName,
      email,
      phone,
      personalPhone,
      personalEmail,
      positionTitle,
      departmentId: Number.isFinite(departmentId as number) ? (departmentId as number) : null,
      terminate: status === "terminated",
    });

    await prisma.$executeRawUnsafe(
      `UPDATE hr_employees SET
        first_name = ?, last_name = ?, email = ?, phone = ?, personal_phone = ?, personal_email = ?,
        position_title = ?, position_id = ?, department_id = ?, employment_type = ?, start_date = ?, end_date = ?,
        status = ?, notes = ?, onboarding_json = ?, offboarding_json = ?, updated_by = ?
       WHERE id = ?`,
      firstName,
      lastName,
      email,
      phone || null,
      personalPhone || null,
      personalEmail || null,
      positionTitle || null,
      Number.isFinite(positionId as number) ? positionId : null,
      Number.isFinite(departmentId as number) ? departmentId : null,
      employmentType,
      startDate,
      endDate,
      status,
      notes || null,
      serializeChecklistJson(onboarding),
      serializeChecklistJson(offboarding),
      actorId,
      id
    );

    const updated = await loadEmployee(id);
    if (!updated) return NextResponse.json({ error: "Zaměstnanec nebyl nalezen." }, { status: 404 });

    await logPersonalistikaAudit({
      userId: actorId,
      action: "update:employee",
      tableName: "hr_employees",
      recordId: id,
      oldValues: mapEmployee(prev),
      newValues: mapEmployee(updated),
    });

    const equipment = await listActiveEquipmentForUser(updated.user_id);
    return NextResponse.json({ success: true, employee: mapEmployee(updated), equipment });
  } catch (e) {
    console.error("Employees PATCH error:", e);
    const msg = e instanceof Error ? e.message : "Chyba při ukládání zaměstnance.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const actorId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(actorId, "personalistika", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění." }, { status: 403 });
  }

  await ensurePersonalistikaTables();
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Neplatné ID." }, { status: 400 });

  const prev = await loadEmployee(id);
  if (!prev) return NextResponse.json({ error: "Zaměstnanec nebyl nalezen." }, { status: 404 });

  await prisma.$executeRawUnsafe(`DELETE FROM hr_employees WHERE id = ?`, id);

  await logPersonalistikaAudit({
    userId: actorId,
    action: "delete:employee",
    tableName: "hr_employees",
    recordId: id,
    oldValues: mapEmployee(prev),
  });

  return NextResponse.json({ success: true });
}
