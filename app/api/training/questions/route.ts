import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { isDifficultyKey } from "@/lib/training/constants";
import { parseCorrectAnswers } from "@/lib/training/csv-import";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const canWrite = await hasModuleAccess(userId, "training", "write");
  const { searchParams } = new URL(req.url);
  const categoryId = parseInt(searchParams.get("category_id") ?? "", 10);
  const search = (searchParams.get("search") ?? "").trim();
  const includeInactive = canWrite && searchParams.get("include_inactive") === "1";

  const where: Record<string, unknown> = {};
  if (!includeInactive) where.is_active = true;
  if (!isNaN(categoryId)) where.category_id = categoryId;
  if (search) where.question = { contains: search };

  const [questions, categories] = await Promise.all([
    prisma.questions.findMany({
      where,
      include: { question_categories: { select: { id: true, name: true, code: true, color: true } } },
      orderBy: [{ category_id: "asc" }, { id: "desc" }],
      take: 500,
    }),
    prisma.question_categories.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({ questions, categories });
}

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
    const categoryId = parseInt(String(body.category_id), 10);
    const question = String(body.question ?? "").trim();
    const optionA = String(body.option_a ?? "").trim();
    const optionB = String(body.option_b ?? "").trim();
    const optionC = String(body.option_c ?? "").trim();
    const optionD = String(body.option_d ?? "").trim();
    const correctList = parseCorrectAnswers(
      String(body.correct_answers ?? body.correct_answer ?? "")
    );

    if (isNaN(categoryId)) {
      return NextResponse.json({ error: "Vyberte kategorii" }, { status: 400 });
    }
    if (!question || !optionA || !optionB) {
      return NextResponse.json(
        { error: "Vyplňte text otázky a možnosti A a B" },
        { status: 400 }
      );
    }
    if (!correctList) {
      return NextResponse.json(
        { error: "Správná odpověď musí být A/B/C/D (i více, oddělené čárkou)" },
        { status: 400 }
      );
    }
    const optionByKey: Record<string, string> = { A: optionA, B: optionB, C: optionC, D: optionD };
    for (const key of correctList) {
      if (!optionByKey[key]) {
        return NextResponse.json(
          { error: `Správná odpověď ${key} odkazuje na prázdnou možnost` },
          { status: 400 }
        );
      }
    }

    const created = await prisma.questions.create({
      data: {
        category_id: categoryId,
        question,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC || null,
        option_d: optionD || null,
        correct_answer: correctList[0],
        correct_answers: correctList.join(","),
        difficulty: isDifficultyKey(body.difficulty) ? body.difficulty : undefined,
        explanation: String(body.explanation ?? "").trim() || null,
        source: String(body.source ?? "").trim() || null,
        is_active: body.is_active !== false,
      },
    });

    return NextResponse.json({ success: true, id: created.id });
  } catch (e) {
    console.error("Training question POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření otázky" }, { status: 500 });
  }
}
