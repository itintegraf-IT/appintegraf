import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { notifyTestAssigned } from "@/lib/training/notify";

async function requireWrite(): Promise<{ userId: number } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění spravovat přiřazení" }, { status: 403 });
  }
  return { userId };
}

function parseDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function parseNotifyOnAssign(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  return value !== false && value !== 0 && value !== "0" && value !== "false";
}

function parseRemindDays(value: unknown): number | null {
  if (value === null || value === "" || value === undefined) return null;
  const parsed = parseInt(String(value), 10);
  if (isNaN(parsed) || parsed < 1) return null;
  return Math.min(90, parsed);
}

export async function GET() {
  const access = await requireWrite();
  if (access instanceof NextResponse) return access;

  try {
    const [assignments, users] = await Promise.all([
      prisma.test_assignments.findMany({
        include: {
          tests: { select: { id: true, name: true, is_active: true } },
          user_groups: {
            select: { id: true, name: true, _count: { select: { user_group_members: true } } },
          },
          target_user: {
            select: { id: true, first_name: true, last_name: true, department_name: true },
          },
          users: { select: { first_name: true, last_name: true } },
          _count: { select: { test_attempts: true } },
        },
        orderBy: [{ is_active: "desc" }, { created_at: "desc" }],
      }),
      prisma.users.findMany({
        where: { is_active: true },
        select: { id: true, first_name: true, last_name: true, department_name: true },
        orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
      }),
    ]);

    return NextResponse.json({ assignments, users });
  } catch (e) {
    console.error("Training assignments GET error:", e);
    return NextResponse.json({ error: "Chyba při načítání přiřazení" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const access = await requireWrite();
  if (access instanceof NextResponse) return access;
  const { userId } = access;

  try {
    const body = await req.json();
    const testId = parseInt(String(body.test_id), 10);
    const targetType = body.target_type === "users" ? "users" : "group";

    if (isNaN(testId)) {
      return NextResponse.json({ error: "Vyberte test" }, { status: 400 });
    }

    const test = await prisma.tests.findUnique({ where: { id: testId } });
    if (!test) return NextResponse.json({ error: "Test nenalezen" }, { status: 404 });

    const startDate = parseDate(body.start_date);
    const endDate = parseDate(body.end_date);
    if (startDate && endDate && endDate < startDate) {
      return NextResponse.json({ error: "Datum konce nesmí být před začátkem" }, { status: 400 });
    }

    const maxAttemptsRaw = parseInt(String(body.max_attempts), 10);
    const maxAttempts = isNaN(maxAttemptsRaw) ? null : Math.min(100, Math.max(1, maxAttemptsRaw));
    const notifyOnAssign = parseNotifyOnAssign(body.notify_on_assign);
    const remindDaysBefore = parseRemindDays(body.remind_days_before);

    const baseData = {
      test_id: testId,
      assigned_by: userId,
      start_date: startDate,
      end_date: endDate,
      max_attempts: maxAttempts,
      is_active: true,
      notify_on_assign: notifyOnAssign,
      remind_days_before: endDate ? remindDaysBefore : null,
    };

    if (targetType === "group") {
      const groupId = parseInt(String(body.group_id), 10);
      if (isNaN(groupId)) {
        return NextResponse.json({ error: "Vyberte skupinu" }, { status: 400 });
      }

      const group = await prisma.user_groups.findUnique({ where: { id: groupId } });
      if (!group) return NextResponse.json({ error: "Skupina nenalezena" }, { status: 404 });

      const duplicate = await prisma.test_assignments.findFirst({
        where: { test_id: testId, group_id: groupId, is_active: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Aktivní přiřazení tohoto testu dané skupině již existuje" },
          { status: 400 }
        );
      }

      const created = await prisma.test_assignments.create({
        data: { ...baseData, group_id: groupId },
      });
      if (notifyOnAssign) {
        await notifyTestAssigned(created.id);
      }
      return NextResponse.json({ success: true, id: created.id, created: 1 });
    }

    const userIds = Array.isArray(body.user_ids)
      ? [...new Set(body.user_ids.map((id: unknown) => parseInt(String(id), 10)).filter((id: number) => !isNaN(id)))]
      : [];

    if (userIds.length === 0) {
      return NextResponse.json({ error: "Vyberte alespoň jednoho uživatele" }, { status: 400 });
    }

    const existingUsers = await prisma.users.findMany({
      where: { id: { in: userIds }, is_active: true },
      select: { id: true },
    });
    const validIds = existingUsers.map((u) => u.id);
    if (validIds.length === 0) {
      return NextResponse.json({ error: "Vybraní uživatelé neexistují nebo nejsou aktivní" }, { status: 400 });
    }

    const duplicates = await prisma.test_assignments.findMany({
      where: { test_id: testId, user_id: { in: validIds }, is_active: true },
      select: { user_id: true },
    });
    const duplicateIds = new Set(duplicates.map((d) => d.user_id).filter((id): id is number => id !== null));
    const toCreate = validIds.filter((id) => !duplicateIds.has(id));

    if (toCreate.length === 0) {
      return NextResponse.json(
        { error: "Všichni vybraní uživatelé již mají aktivní přiřazení tohoto testu" },
        { status: 400 }
      );
    }

    await prisma.test_assignments.createMany({
      data: toCreate.map((uid) => ({
        ...baseData,
        user_id: uid,
      })),
    });

    if (notifyOnAssign) {
      const createdRows = await prisma.test_assignments.findMany({
        where: { test_id: testId, user_id: { in: toCreate }, is_active: true },
        select: { id: true },
      });
      for (const row of createdRows) {
        await notifyTestAssigned(row.id);
      }
    }

    return NextResponse.json({
      success: true,
      created: toCreate.length,
      skipped: validIds.length - toCreate.length,
    });
  } catch (e) {
    console.error("Training assignment POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření přiřazení" }, { status: 500 });
  }
}
