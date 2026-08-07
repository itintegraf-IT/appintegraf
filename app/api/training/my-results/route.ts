import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** Historie vlastních pokusů přihlášeného uživatele. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);

  const attempts = await prisma.test_attempts.findMany({
    where: { user_id: userId, completed_at: { not: null } },
    include: {
      tests: { select: { id: true, name: true, pass_percentage: true } },
    },
    orderBy: { started_at: "desc" },
    take: 100,
  });

  type AttemptRow = (typeof attempts)[number];

  return NextResponse.json({
    attempts: attempts.map((a: AttemptRow) => ({
      id: a.id,
      test: a.tests,
      started_at: a.started_at,
      completed_at: a.completed_at,
      score: a.score === null ? null : Number(a.score),
      passed: a.passed,
      time_spent: a.time_spent,
    })),
  });
}
