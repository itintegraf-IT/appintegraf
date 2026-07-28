import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

/**
 * Admin report výsledků testů.
 * Query: test_id, user_id, passed (1/0), format=csv
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění zobrazit výsledky" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const testId = parseInt(searchParams.get("test_id") ?? "", 10);
  const filterUserId = parseInt(searchParams.get("user_id") ?? "", 10);
  const passedParam = searchParams.get("passed");
  const format = searchParams.get("format");

  const where: Record<string, unknown> = { completed_at: { not: null } };
  if (!isNaN(testId)) where.test_id = testId;
  if (!isNaN(filterUserId)) where.user_id = filterUserId;
  if (passedParam === "1") where.passed = true;
  if (passedParam === "0") where.passed = false;

  const attempts = await prisma.test_attempts.findMany({
    where,
    include: {
      tests: { select: { id: true, name: true, pass_percentage: true } },
      users: { select: { id: true, first_name: true, last_name: true, department_name: true } },
      test_assignments: {
        select: { id: true, user_groups: { select: { name: true } } },
      },
    },
    orderBy: { started_at: "desc" },
    take: format === "csv" ? 10000 : 500,
  });

  type AttemptRow = (typeof attempts)[number];

  if (format === "csv") {
    const header = [
      "Test",
      "Uživatel",
      "Oddělení",
      "Skupina",
      "Zahájeno",
      "Dokončeno",
      "Skóre (%)",
      "Splněno",
      "Čas (s)",
    ].join(";");

    const escape = (value: string) =>
      /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

    const lines = attempts.map((a: AttemptRow) =>
      [
        escape(a.tests.name),
        escape(`${a.users.first_name} ${a.users.last_name}`.trim()),
        escape(a.users.department_name ?? ""),
        escape(a.test_assignments?.user_groups?.name ?? ""),
        a.started_at.toISOString(),
        a.completed_at?.toISOString() ?? "",
        a.score === null ? "" : String(Number(a.score)),
        a.passed ? "ano" : "ne",
        a.time_spent === null ? "" : String(a.time_spent),
      ].join(";")
    );

    const csv = "\uFEFF" + [header, ...lines].join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="vysledky-skoleni-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  // Souhrnná statistika podle testů (pro dashboard reportu)
  const statsByTest = new Map<
    number,
    { testId: number; name: string; attempts: number; passed: number; scoreSum: number; scoreCount: number }
  >();
  for (const a of attempts as AttemptRow[]) {
    let stat = statsByTest.get(a.test_id);
    if (!stat) {
      stat = { testId: a.test_id, name: a.tests.name, attempts: 0, passed: 0, scoreSum: 0, scoreCount: 0 };
      statsByTest.set(a.test_id, stat);
    }
    stat.attempts++;
    if (a.passed) stat.passed++;
    if (a.score !== null) {
      stat.scoreSum += Number(a.score);
      stat.scoreCount++;
    }
  }

  const stats = [...statsByTest.values()].map((s) => ({
    test_id: s.testId,
    name: s.name,
    attempts: s.attempts,
    passed: s.passed,
    avg_score: s.scoreCount > 0 ? Math.round((s.scoreSum / s.scoreCount) * 100) / 100 : null,
  }));

  return NextResponse.json({
    attempts: attempts.map((a: AttemptRow) => ({
      id: a.id,
      test: a.tests,
      user: a.users,
      group: a.test_assignments?.user_groups?.name ?? null,
      started_at: a.started_at,
      completed_at: a.completed_at,
      score: a.score === null ? null : Number(a.score),
      passed: a.passed,
      time_spent: a.time_spent,
    })),
    stats,
  });
}
