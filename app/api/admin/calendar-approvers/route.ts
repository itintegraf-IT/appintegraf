import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Neautorizováno" }, { status: 401 }) };
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return { error: NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 }) };
  }
  return { userId };
}

function parseUserId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = parseInt(String(value), 10);
  return isNaN(n) ? null : n;
}

function validateApproverIds(body: {
  primary_user_id?: unknown;
  secondary_user_id?: unknown;
  tertiary_user_id?: unknown;
}): { ok: true; primary: number; secondary: number | null; tertiary: number | null } | { ok: false; message: string } {
  const primary = parseUserId(body.primary_user_id);
  const secondary = parseUserId(body.secondary_user_id);
  const tertiary = parseUserId(body.tertiary_user_id);

  if (!primary) {
    return { ok: false, message: "Primární schvalovatel je povinný." };
  }

  const ids = [primary, secondary, tertiary].filter((x): x is number => x !== null);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, message: "Schvalovatelé se nesmí opakovat." };
  }

  return { ok: true, primary, secondary, tertiary };
}

async function assertActiveUsers(userIds: number[]) {
  const users = await prisma.users.findMany({
    where: { id: { in: userIds }, is_active: true },
    select: { id: true },
  });
  if (users.length !== userIds.length) {
    return false;
  }
  return true;
}

/** GET /api/admin/calendar-approvers – přehled oddělení a schvalovatelů */
export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;

  const departments = await prisma.departments.findMany({
    where: { is_active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      manager_id: true,
      users: { select: { id: true, first_name: true, last_name: true } },
      calendar_department_approvers: {
        select: {
          id: true,
          primary_user_id: true,
          secondary_user_id: true,
          tertiary_user_id: true,
          users_primary: { select: { id: true, first_name: true, last_name: true } },
          users_secondary: { select: { id: true, first_name: true, last_name: true } },
          users_tertiary: { select: { id: true, first_name: true, last_name: true } },
        },
      },
    },
  });

  return NextResponse.json({ departments });
}

/** PUT /api/admin/calendar-approvers – body: { department_id, primary_user_id, secondary_user_id?, tertiary_user_id? } */
export async function PUT(req: NextRequest) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;

  const body = await req.json().catch(() => ({}));
  const departmentId = parseUserId(body.department_id);
  if (!departmentId) {
    return NextResponse.json({ error: "Neplatné oddělení" }, { status: 400 });
  }

  const parsed = validateApproverIds(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const dept = await prisma.departments.findUnique({
    where: { id: departmentId },
    select: { id: true },
  });
  if (!dept) {
    return NextResponse.json({ error: "Oddělení nenalezeno" }, { status: 404 });
  }

  const userIds = [parsed.primary, parsed.secondary, parsed.tertiary].filter(
    (x): x is number => x !== null
  );
  if (!(await assertActiveUsers(userIds))) {
    return NextResponse.json({ error: "Vybraný schvalovatel neexistuje nebo není aktivní." }, { status: 400 });
  }

  const row = await prisma.calendar_department_approvers.upsert({
    where: { department_id: departmentId },
    create: {
      department_id: departmentId,
      primary_user_id: parsed.primary,
      secondary_user_id: parsed.secondary,
      tertiary_user_id: parsed.tertiary,
    },
    update: {
      primary_user_id: parsed.primary,
      secondary_user_id: parsed.secondary,
      tertiary_user_id: parsed.tertiary,
      updated_at: new Date(),
    },
    include: {
      users_primary: { select: { id: true, first_name: true, last_name: true } },
      users_secondary: { select: { id: true, first_name: true, last_name: true } },
      users_tertiary: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({ approver: row });
}

/** DELETE /api/admin/calendar-approvers?department_id= – odstraní konfiguraci (fallback na manager_id) */
export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;

  const departmentId = parseUserId(new URL(req.url).searchParams.get("department_id"));
  if (!departmentId) {
    return NextResponse.json({ error: "Neplatné oddělení" }, { status: 400 });
  }

  await prisma.calendar_department_approvers.deleteMany({
    where: { department_id: departmentId },
  });

  return NextResponse.json({ success: true });
}
