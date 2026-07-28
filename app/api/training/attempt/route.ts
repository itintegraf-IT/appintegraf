import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getTestAccessForUser } from "@/lib/training/access";
import { isAnswerKey, type AnswerKey } from "@/lib/training/constants";

/** Normalizace odpovědi klienta (string nebo pole) na setříděné unikátní pole písmen. */
function normalizeUserAnswer(value: unknown): AnswerKey[] {
  const list = Array.isArray(value) ? value : [value];
  const letters = list
    .map((v) => String(v ?? "").toUpperCase().trim())
    .filter((v) => isAnswerKey(v)) as AnswerKey[];
  return [...new Set(letters)].sort();
}

function correctSetOf(question: { correct_answer: string; correct_answers: string | null }): AnswerKey[] {
  const raw = question.correct_answers?.trim() || question.correct_answer;
  const letters = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => isAnswerKey(s)) as AnswerKey[];
  return [...new Set(letters)].sort();
}

function sameSet(a: AnswerKey[], b: AnswerKey[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { test_id, answers, time_spent } = body as {
      test_id: number;
      answers: Record<number, string | string[]>;
      time_spent?: number;
    };

    if (!test_id || !answers || typeof answers !== "object") {
      return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
    }

    const userId = parseInt(session.user.id, 10);

    // Vynucení přiřazení, termínů a limitu pokusů
    const testAccess = await getTestAccessForUser(userId, test_id);
    if (!testAccess.allowed) {
      return NextResponse.json(
        { error: testAccess.reason ?? "Test není dostupný" },
        { status: 403 }
      );
    }

    const test = await prisma.tests.findUnique({
      where: { id: test_id },
      include: {
        test_questions: { include: { questions: true }, orderBy: { sort_order: "asc" } },
      },
    });

    if (!test || !test.is_active) {
      return NextResponse.json({ error: "Test nenalezen" }, { status: 404 });
    }

    const timeSpentSeconds = Number.isFinite(Number(time_spent))
      ? Math.max(0, Math.round(Number(time_spent)))
      : null;

    const attempt = await prisma.test_attempts.create({
      data: {
        test_id,
        user_id: userId,
        assignment_id: testAccess.assignmentId,
        started_at: timeSpentSeconds
          ? new Date(Date.now() - timeSpentSeconds * 1000)
          : new Date(),
      },
    });

    type TestQuestionRow = (typeof test.test_questions)[number];
    let correctCount = 0;
    const answerRows: {
      attempt_id: number;
      question_id: number;
      user_answer: AnswerKey | null;
      user_answers: string | null;
      is_correct: boolean;
    }[] = [];

    for (const tq of test.test_questions as TestQuestionRow[]) {
      const userAnswers = normalizeUserAnswer(answers[tq.question_id]);
      const correctAnswers = correctSetOf(tq.questions);
      const isCorrect = userAnswers.length > 0 && sameSet(userAnswers, correctAnswers);
      if (isCorrect) correctCount++;
      answerRows.push({
        attempt_id: attempt.id,
        question_id: tq.question_id,
        user_answer: userAnswers[0] ?? null,
        user_answers: userAnswers.length > 0 ? userAnswers.join(",") : null,
        is_correct: isCorrect,
      });
    }

    if (answerRows.length > 0) {
      await prisma.test_answers.createMany({ data: answerRows });
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
        time_spent: timeSpentSeconds,
      },
    });

    // Review odpovědí (jen pokud to test povoluje)
    const review = test.show_answers
      ? (test.test_questions as TestQuestionRow[]).map((tq) => {
          const userAnswers = normalizeUserAnswer(answers[tq.question_id]);
          const correctAnswers = correctSetOf(tq.questions);
          return {
            question_id: tq.question_id,
            question: tq.questions.question,
            options: {
              A: tq.questions.option_a,
              B: tq.questions.option_b,
              C: tq.questions.option_c,
              D: tq.questions.option_d,
            },
            user_answers: userAnswers,
            correct_answers: correctAnswers,
            is_correct: userAnswers.length > 0 && sameSet(userAnswers, correctAnswers),
            explanation: tq.questions.explanation,
          };
        })
      : null;

    const attemptsRemaining =
      testAccess.attemptsRemaining === null ? null : Math.max(0, testAccess.attemptsRemaining - 1);

    return NextResponse.json({
      success: true,
      attempt_id: attempt.id,
      score,
      passed,
      correct: correctCount,
      total,
      pass_percentage: passPercent,
      attempts_remaining: attemptsRemaining,
      review,
    });
  } catch (e) {
    console.error("Training attempt error:", e);
    return NextResponse.json({ error: "Chyba při odevzdání testu" }, { status: 500 });
  }
}
