import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { test_id, answers } = body as { test_id: number; answers: Record<number, string> };

    if (!test_id || !answers || typeof answers !== "object") {
      return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
    }

    const userId = parseInt(session.user.id, 10);

    const test = await prisma.tests.findUnique({
      where: { id: test_id },
      include: { test_questions: { include: { questions: true }, orderBy: { sort_order: "asc" } } },
    });

    if (!test || !test.is_active) {
      return NextResponse.json({ error: "Test nenalezen" }, { status: 404 });
    }

    const attempt = await prisma.test_attempts.create({
      data: {
        test_id,
        user_id: userId,
        started_at: new Date(),
      },
    });

    const correctMap: Record<string, string> = {
      A: "A",
      B: "B",
      C: "C",
      D: "D",
    };

    let correctCount = 0;
    for (const tq of test.test_questions) {
      const userAnswer = answers[tq.question_id];
      const correctAnswer = tq.questions.correct_answer;
      const isCorrect = !!(userAnswer && correctMap[userAnswer] === correctAnswer);

      if (isCorrect) correctCount++;

      await prisma.test_answers.create({
        data: {
          attempt_id: attempt.id,
          question_id: tq.question_id,
          user_answer: userAnswer && ["A", "B", "C", "D"].includes(userAnswer)
            ? (userAnswer as "A" | "B" | "C" | "D")
            : null,
          is_correct: isCorrect,
        },
      });
    }

    const total = test.test_questions.length;
    const score = total > 0 ? Math.round((correctCount / total) * 10000) / 100 : 0;
    const passPercent = test.pass_percentage ?? 70;
    const passed = score >= passPercent;

    await prisma.test_attempts.update({
      where: { id: attempt.id },
      data: {
        completed_at: new Date(),
        score,
        passed,
      },
    });

    return NextResponse.json({
      success: true,
      attempt_id: attempt.id,
      score,
      passed,
      correct: correctCount,
      total,
      pass_percentage: passPercent,
    });
  } catch (e) {
    console.error("Training attempt error:", e);
    return NextResponse.json({ error: "Chyba při odevzdání testu" }, { status: 500 });
  }
}
