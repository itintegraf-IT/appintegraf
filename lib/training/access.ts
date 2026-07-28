import { prisma } from "@/lib/db";

/**
 * Přístupová logika testů modulu IT Školení.
 *
 * Pravidla viditelnosti:
 * - Test bez aktivního přiřazení je dostupný všem uživatelům s přístupem k modulu.
 * - Test s aktivním přiřazením vidí pouze:
 *   - členové přiřazených skupin, nebo
 *   - uživatelé s individuálním přiřazením,
 *   a to v časovém okně start_date–end_date a do vyčerpání max_attempts.
 */

export type TestAccess = {
  allowed: boolean;
  reason: string | null;
  assignmentId: number | null;
  attemptsUsed: number;
  attemptsRemaining: number | null;
  endDate: Date | null;
};

type AssignmentRow = {
  id: number;
  group_id: number | null;
  user_id: number | null;
  start_date: Date | null;
  end_date: Date | null;
  max_attempts: number | null;
};

export async function getUserGroupIds(userId: number): Promise<number[]> {
  const memberships = await prisma.user_group_members.findMany({
    where: { user_id: userId },
    select: { group_id: true },
  });
  return memberships.map((m) => m.group_id);
}

function isWithinWindow(now: Date, start: Date | null, end: Date | null): boolean {
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

function assignmentMatchesUser(assignment: AssignmentRow, userId: number, groupIds: number[]): boolean {
  if (assignment.user_id !== null) return assignment.user_id === userId;
  if (assignment.group_id !== null) return groupIds.includes(assignment.group_id);
  return false;
}

export async function getTestAccessForUser(userId: number, testId: number): Promise<TestAccess> {
  const denied = (reason: string): TestAccess => ({
    allowed: false,
    reason,
    assignmentId: null,
    attemptsUsed: 0,
    attemptsRemaining: null,
    endDate: null,
  });

  const test = await prisma.tests.findUnique({
    where: { id: testId },
    include: {
      test_assignments: { where: { is_active: true } },
    },
  });

  if (!test || !test.is_active) return denied("Test nenalezen nebo není aktivní");

  const assignments = test.test_assignments as AssignmentRow[];

  if (assignments.length === 0) {
    return {
      allowed: true,
      reason: null,
      assignmentId: null,
      attemptsUsed: 0,
      attemptsRemaining: null,
      endDate: null,
    };
  }

  const groupIds = await getUserGroupIds(userId);
  const now = new Date();

  const forUser = assignments.filter((a) => assignmentMatchesUser(a, userId, groupIds));
  if (forUser.length === 0) return denied("Test vám není přidělen");

  const inWindow = forUser.filter((a) => isWithinWindow(now, a.start_date, a.end_date));
  if (inWindow.length === 0) {
    const upcoming = forUser.find((a) => a.start_date && now < a.start_date);
    if (upcoming?.start_date) {
      return denied(`Test bude dostupný od ${upcoming.start_date.toLocaleDateString("cs-CZ")}`);
    }
    return denied("Termín pro vyplnění testu již vypršel");
  }

  let best: { assignment: AssignmentRow; used: number; remaining: number | null } | null = null;
  for (const assignment of inWindow) {
    const used = await prisma.test_attempts.count({
      where: { user_id: userId, assignment_id: assignment.id, completed_at: { not: null } },
    });
    const max = assignment.max_attempts ?? null;
    const remaining = max === null ? null : Math.max(0, max - used);
    if (
      !best ||
      remaining === null ||
      (best.remaining !== null && remaining > best.remaining)
    ) {
      best = { assignment, used, remaining };
      if (remaining === null) break;
    }
  }

  if (!best) return denied("Test vám není přidělen");

  if (best.remaining !== null && best.remaining <= 0) {
    return {
      allowed: false,
      reason: "Vyčerpali jste maximální počet pokusů",
      assignmentId: best.assignment.id,
      attemptsUsed: best.used,
      attemptsRemaining: 0,
      endDate: best.assignment.end_date,
    };
  }

  return {
    allowed: true,
    reason: null,
    assignmentId: best.assignment.id,
    attemptsUsed: best.used,
    attemptsRemaining: best.remaining,
    endDate: best.assignment.end_date,
  };
}

export type VisibleTest = {
  id: number;
  name: string;
  description: string | null;
  time_limit: number | null;
  pass_percentage: number | null;
  questionCount: number;
  assignment: {
    id: number;
    start_date: Date | null;
    end_date: Date | null;
    max_attempts: number | null;
  } | null;
  attemptsUsed: number;
  attemptsRemaining: number | null;
  bestScore: number | null;
  passed: boolean;
  lastAttemptAt: Date | null;
};

export async function getVisibleTestsForUser(userId: number): Promise<VisibleTest[]> {
  const [tests, groupIds] = await Promise.all([
    prisma.tests.findMany({
      where: { is_active: true },
      include: {
        test_assignments: { where: { is_active: true } },
        _count: { select: { test_questions: true } },
      },
      orderBy: { name: "asc" },
    }),
    getUserGroupIds(userId),
  ]);

  const now = new Date();
  const testIds = tests.map((t) => t.id);

  const attempts = testIds.length
    ? await prisma.test_attempts.findMany({
        where: { user_id: userId, test_id: { in: testIds }, completed_at: { not: null } },
        orderBy: { started_at: "desc" },
      })
    : [];

  const result: VisibleTest[] = [];

  for (const test of tests) {
    const assignments = test.test_assignments as AssignmentRow[];
    let visibleAssignment: AssignmentRow | null = null;

    if (assignments.length > 0) {
      const forUser = assignments.filter(
        (a) =>
          assignmentMatchesUser(a, userId, groupIds) &&
          isWithinWindow(now, a.start_date, a.end_date)
      );
      if (forUser.length === 0) continue;
      visibleAssignment = forUser[0];
    }

    const testAttempts = attempts.filter((a) => a.test_id === test.id);
    const assignmentAttempts = visibleAssignment
      ? testAttempts.filter((a) => a.assignment_id === visibleAssignment!.id)
      : testAttempts;

    const bestScore = testAttempts.reduce<number | null>((acc, a) => {
      const score = a.score === null ? null : Number(a.score);
      if (score === null) return acc;
      return acc === null || score > acc ? score : acc;
    }, null);

    const maxAttempts = visibleAssignment?.max_attempts ?? null;
    const attemptsUsed = assignmentAttempts.length;

    result.push({
      id: test.id,
      name: test.name,
      description: test.description,
      time_limit: test.time_limit,
      pass_percentage: test.pass_percentage,
      questionCount: test._count.test_questions,
      assignment: visibleAssignment
        ? {
            id: visibleAssignment.id,
            start_date: visibleAssignment.start_date,
            end_date: visibleAssignment.end_date,
            max_attempts: visibleAssignment.max_attempts,
          }
        : null,
      attemptsUsed,
      attemptsRemaining: maxAttempts === null ? null : Math.max(0, maxAttempts - attemptsUsed),
      bestScore,
      passed: testAttempts.some((a) => a.passed === true),
      lastAttemptAt: testAttempts[0]?.started_at ?? null,
    });
  }

  return result;
}
