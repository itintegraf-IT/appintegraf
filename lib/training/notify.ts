import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

export const NOTIF_TYPE_ASSIGNED = "training_assigned";
export const NOTIF_TYPE_DEADLINE = "training_deadline";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateCs(date: Date | null): string | null {
  if (!date) return null;
  return date.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function testLink(testId: number): string {
  return `/training/test/${testId}`;
}

function deadlineLink(testId: number, assignmentId: number): string {
  return `/training/test/${testId}?assignment=${assignmentId}`;
}

/** Uživatelé, kterým má jít notifikace z daného přiřazení (jen s přístupem k modulu školení). */
export async function collectAssignmentRecipientIds(assignment: {
  group_id: number | null;
  user_id: number | null;
}): Promise<number[]> {
  let candidateIds: number[] = [];

  if (assignment.user_id !== null) {
    candidateIds = [assignment.user_id];
  } else if (assignment.group_id !== null) {
    const members = await prisma.user_group_members.findMany({
      where: { group_id: assignment.group_id },
      select: { user_id: true },
    });
    candidateIds = members.map((m) => m.user_id);
  }

  if (candidateIds.length === 0) return [];

  const withAccess = await Promise.all(
    candidateIds.map(async (id) => ({
      id,
      allowed: await hasModuleAccess(id, "training", "read"),
    }))
  );
  return withAccess.filter((x) => x.allowed).map((x) => x.id);
}

type AssignmentNotifyRow = {
  id: number;
  test_id: number;
  notify_on_assign: boolean;
  start_date: Date | null;
  end_date: Date | null;
  max_attempts: number | null;
  group_id: number | null;
  user_id: number | null;
  tests: { name: string };
  user_groups: { name: string } | null;
};

/** In-app notifikace při novém přiřazení testu. */
export async function notifyTestAssigned(assignmentId: number): Promise<number> {
  const assignment = await prisma.test_assignments.findUnique({
    where: { id: assignmentId },
    include: {
      tests: { select: { name: true } },
      user_groups: { select: { name: true } },
    },
  });

  if (!assignment || assignment.is_active === false || !assignment.notify_on_assign) {
    return 0;
  }

  const row = assignment as AssignmentNotifyRow;
  const recipientIds = await collectAssignmentRecipientIds(row);
  if (recipientIds.length === 0) return 0;

  const endLabel = formatDateCs(row.end_date);
  const startLabel = formatDateCs(row.start_date);
  const targetLabel = row.user_id
    ? null
    : row.user_groups?.name
      ? `skupině „${row.user_groups.name}"`
      : null;

  let message = `Byl vám přidělen test „${row.tests.name}"`;
  if (targetLabel) message += ` (${targetLabel})`;
  if (startLabel) message += `. Dostupný od ${startLabel}`;
  if (endLabel) message += `${startLabel ? "" : "."} Termín do ${endLabel}`;
  else if (!startLabel) message += ".";
  if (row.max_attempts !== null) {
    message += ` Max. ${row.max_attempts} pokusů.`;
  }

  let sent = 0;
  for (const userId of recipientIds) {
    await prisma.notifications.create({
      data: {
        user_id: userId,
        title: "Nový test k vyplnění",
        message,
        type: NOTIF_TYPE_ASSIGNED,
        link: testLink(row.test_id),
      },
    });
    sent += 1;
  }
  return sent;
}

async function wasDeadlineNotifiedRecently(
  userId: number,
  testId: number,
  assignmentId: number
): Promise<boolean> {
  const since = new Date();
  since.setDate(since.getDate() - 1);
  const link = deadlineLink(testId, assignmentId);

  const existing = await prisma.notifications.findFirst({
    where: {
      user_id: userId,
      type: NOTIF_TYPE_DEADLINE,
      link,
      created_at: { gte: since },
    },
    select: { id: true },
  });
  return !!existing;
}

function daysUntilEnd(endDate: Date): number {
  const today = startOfToday();
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Denní připomínky před termínem testu.
 * Odešle notifikaci, pokud zbývá přesně remind_days_before dní (nebo méně, ale ještě ne vypršelo).
 */
export async function runTrainingDeadlineReminders(): Promise<{
  notified: number;
  skipped: number;
}> {
  const assignments = await prisma.test_assignments.findMany({
    where: {
      is_active: true,
      end_date: { not: null },
      remind_days_before: { not: null },
    },
    include: {
      tests: { select: { id: true, name: true, is_active: true } },
      user_groups: { select: { name: true } },
    },
  });

  let notified = 0;
  let skipped = 0;

  for (const assignment of assignments) {
    if (!assignment.tests.is_active || !assignment.end_date || assignment.remind_days_before == null) {
      skipped += 1;
      continue;
    }

    const daysLeft = daysUntilEnd(assignment.end_date);
    if (daysLeft <= 0 || daysLeft > assignment.remind_days_before) {
      skipped += 1;
      continue;
    }

    const recipientIds = await collectAssignmentRecipientIds(assignment);
    const endLabel = formatDateCs(assignment.end_date);
    const daysWord =
      daysLeft === 1 ? "1 den" : daysLeft >= 2 && daysLeft <= 4 ? `${daysLeft} dny` : `${daysLeft} dní`;

    for (const userId of recipientIds) {
      const passed = await prisma.test_attempts.findFirst({
        where: {
          user_id: userId,
          assignment_id: assignment.id,
          passed: true,
          completed_at: { not: null },
        },
        select: { id: true },
      });
      if (passed) {
        skipped += 1;
        continue;
      }

      if (await wasDeadlineNotifiedRecently(userId, assignment.test_id, assignment.id)) {
        skipped += 1;
        continue;
      }

      await prisma.notifications.create({
        data: {
          user_id: userId,
          title: "Blížící se termín testu",
          message: `Test „${assignment.tests.name}" je potřeba vyplnit do ${endLabel} (zbývá ${daysWord}).`,
          type: NOTIF_TYPE_DEADLINE,
          link: deadlineLink(assignment.test_id, assignment.id),
        },
      });
      notified += 1;
    }
  }

  return { notified, skipped };
}
