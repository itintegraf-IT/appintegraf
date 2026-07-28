import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

/**
 * Hromadné smazání otázek.
 * Otázky použité v testech nebo s odpověďmi se pouze deaktivují (kvůli historii výsledků),
 * nepoužité se smažou.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění spravovat otázky" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const ids = Array.isArray(body.ids)
      ? ([
          ...new Set(
            body.ids
              .map((id: unknown) => parseInt(String(id), 10))
              .filter((id: number) => !isNaN(id))
          ),
        ] as number[])
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "Nebyly vybrány žádné otázky" }, { status: 400 });
    }

    const [usedInTests, usedInAnswers] = await Promise.all([
      prisma.test_questions.findMany({
        where: { question_id: { in: ids } },
        select: { question_id: true },
      }),
      prisma.test_answers.findMany({
        where: { question_id: { in: ids } },
        select: { question_id: true },
      }),
    ]);

    const usedIds = new Set<number>([
      ...usedInTests.map((r: { question_id: number }) => r.question_id),
      ...usedInAnswers.map((r: { question_id: number }) => r.question_id),
    ]);

    const toDeactivate = ids.filter((id) => usedIds.has(id));
    const toDelete = ids.filter((id) => !usedIds.has(id));

    await prisma.$transaction([
      ...(toDeactivate.length > 0
        ? [
            prisma.questions.updateMany({
              where: { id: { in: toDeactivate } },
              data: { is_active: false },
            }),
          ]
        : []),
      ...(toDelete.length > 0
        ? [prisma.questions.deleteMany({ where: { id: { in: toDelete } } })]
        : []),
    ]);

    return NextResponse.json({
      success: true,
      deleted: toDelete.length,
      deactivated: toDeactivate.length,
    });
  } catch (e) {
    console.error("Training questions bulk-delete error:", e);
    return NextResponse.json({ error: "Chyba při hromadném mazání otázek" }, { status: 500 });
  }
}
