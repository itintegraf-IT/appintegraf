import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getTestAccessForUser } from "@/lib/training/access";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const userId = parseInt(session.user.id, 10);
  const access = await getTestAccessForUser(userId, id);
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.reason ?? "Test není dostupný" },
      { status: 403 }
    );
  }

  const test = await prisma.tests.findUnique({
    where: { id, is_active: true },
    include: {
      test_questions: {
        include: {
          questions: {
            select: {
              id: true,
              question: true,
              option_a: true,
              option_b: true,
              option_c: true,
              option_d: true,
              correct_answer: true,
              correct_answers: true,
            },
          },
        },
        orderBy: { sort_order: "asc" },
      },
    },
  });

  if (!test) {
    return NextResponse.json({ error: "Test nenalezen" }, { status: 404 });
  }

  // Správné odpovědi se klientovi neposílají – jen počet (kvůli režimu více odpovědí)
  type TestQuestionRow = (typeof test.test_questions)[number];
  const sanitizedQuestions = (test.test_questions as TestQuestionRow[]).map((tq) => {
    const raw = tq.questions.correct_answers?.trim() || tq.questions.correct_answer;
    const correctCount = new Set(
      raw
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean)
    ).size;
    return {
      id: tq.id,
      question_id: tq.question_id,
      questions: {
        id: tq.questions.id,
        question: tq.questions.question,
        option_a: tq.questions.option_a,
        option_b: tq.questions.option_b,
        option_c: tq.questions.option_c,
        option_d: tq.questions.option_d,
      },
      correct_count: correctCount,
    };
  });

  return NextResponse.json({
    id: test.id,
    name: test.name,
    time_limit: test.time_limit,
    pass_percentage: test.pass_percentage,
    test_questions: sanitizedQuestions,
    attempts_remaining: access.attemptsRemaining,
    end_date: access.endDate,
  });
}
