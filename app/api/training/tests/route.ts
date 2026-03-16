import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění vytvářet testy" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      name,
      description = "",
      time_limit = 30,
      pass_percentage = 70,
      show_answers = true,
      question_ids = [],
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Vyplňte název testu" }, { status: 400 });
    }

    const test = await prisma.tests.create({
      data: {
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
        time_limit: Math.min(180, Math.max(5, parseInt(String(time_limit), 10) || 30)),
        pass_percentage: Math.min(100, Math.max(0, parseInt(String(pass_percentage), 10) ?? 70)),
        show_answers: !!show_answers,
        is_active: true,
        created_by: userId,
      },
    });

    if (Array.isArray(question_ids) && question_ids.length > 0) {
      const validIds = question_ids
        .map((id: unknown) => parseInt(String(id), 10))
        .filter((id: number) => !isNaN(id));
      if (validIds.length > 0) {
        await prisma.test_questions.createMany({
          data: validIds.map((qId, idx) => ({
            test_id: test.id,
            question_id: qId,
            sort_order: idx,
          })),
        });
      }
    }

    return NextResponse.json({ success: true, id: test.id });
  } catch (e) {
    console.error("Training test POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření testu" }, { status: 500 });
  }
}
