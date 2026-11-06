import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import {
  ensurePersonalistikaTables,
  parseChecklistJson,
  type EmployeeRow,
} from "@/lib/personalistika-db";
import { computeOnboardingProgress } from "@/lib/personalistika-employees";
import { ONBOARDING_HR_KEYS, ONBOARDING_IT_KEYS } from "@/lib/personalistika-employee-types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "personalistika", "read"))) {
    return NextResponse.json({ error: "Nemáte přístup." }, { status: 403 });
  }

  await ensurePersonalistikaTables();

  const candidateCounts = (await prisma.$queryRawUnsafe(
    `SELECT status, COUNT(*) AS cnt FROM hr_candidate_applications GROUP BY status`
  )) as { status: string; cnt: number | bigint }[];

  const byStatus: Record<string, number> = {};
  for (const row of candidateCounts) {
    byStatus[row.status] = Number(row.cnt);
  }

  const activeEmployees = (await prisma.$queryRawUnsafe(
    `SELECT id, first_name, last_name, onboarding_json, end_date, status
     FROM hr_employees WHERE status = 'active' ORDER BY last_name ASC LIMIT 500`
  )) as Pick<EmployeeRow, "id" | "first_name" | "last_name" | "onboarding_json" | "end_date" | "status">[];

  const totalKeys = ONBOARDING_HR_KEYS.length + ONBOARDING_IT_KEYS.length;
  const incompleteOnboarding = activeEmployees
    .map((e) => {
      const progress = computeOnboardingProgress(parseChecklistJson(e.onboarding_json));
      return {
        id: e.id,
        name: `${e.last_name} ${e.first_name}`.trim(),
        done: progress.done,
        total: progress.total,
      };
    })
    .filter((e) => e.done < totalKeys)
    .slice(0, 20);

  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const soonStr = soon.toISOString().slice(0, 10);
  const upcomingExits = (await prisma.$queryRawUnsafe(
    `SELECT id, first_name, last_name, end_date
     FROM hr_employees
     WHERE status = 'active' AND end_date IS NOT NULL AND end_date <= ?
     ORDER BY end_date ASC LIMIT 20`,
    soonStr
  )) as Array<{ id: number; first_name: string; last_name: string; end_date: Date | string }>;

  return NextResponse.json({
    candidates: {
      new: byStatus.new ?? 0,
      in_review: byStatus.in_review ?? 0,
      invited: byStatus.invited ?? 0,
      accepted: byStatus.accepted ?? 0,
      rejected: byStatus.rejected ?? 0,
    },
    incompleteOnboarding,
    upcomingExits: upcomingExits.map((e) => ({
      id: e.id,
      name: `${e.last_name} ${e.first_name}`.trim(),
      end_date:
        typeof e.end_date === "string"
          ? e.end_date.slice(0, 10)
          : e.end_date.toISOString().slice(0, 10),
    })),
  });
}
