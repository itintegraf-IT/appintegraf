import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { isDifficultyKey } from "@/lib/training/constants";
import { parseCorrectAnswers } from "@/lib/training/csv-import";

async function requireWrite(): Promise<{ userId: number } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění spravovat otázky" }, { status: 403 });
  }
  return { userId };
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireWrite();
  if (access instanceof NextResponse) return access;

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  try {
    const body = await req.json();
    const existing = await prisma.questions.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Otázka nenalezena" }, { status: 404 });

    const data: Record<string, unknown> = {};

    if (body.category_id !== undefined) {
      const categoryId = parseInt(String(body.category_id), 10);
      if (isNaN(categoryId)) return NextResponse.json({ error: "Neplatná kategorie" }, { status: 400 });
      data.category_id = categoryId;
    }
    if (body.question !== undefined) {
      const question = String(body.question).trim();
      if (!question) return NextResponse.json({ error: "Text otázky nesmí být prázdný" }, { status: 400 });
      data.question = question;
    }
    for (const key of ["option_a", "option_b"] as const) {
      if (body[key] !== undefined) {
        const value = String(body[key]).trim();
        if (!value) return NextResponse.json({ error: "Možnosti A a B jsou povinné" }, { status: 400 });
        data[key] = value;
      }
    }
    for (const key of ["option_c", "option_d"] as const) {
      if (body[key] !== undefined) data[key] = String(body[key]).trim() || null;
    }
    if (body.correct_answers !== undefined || body.correct_answer !== undefined) {
      const correctList = parseCorrectAnswers(
        String(body.correct_answers ?? body.correct_answer ?? "")
      );
      if (!correctList) {
        return NextResponse.json(
          { error: "Správná odpověď musí být A/B/C/D (i více, oddělené čárkou)" },
          { status: 400 }
        );
      }
      data.correct_answer = correctList[0];
      data.correct_answers = correctList.join(",");
    }
    if (body.difficulty !== undefined) {
      if (body.difficulty !== null && !isDifficultyKey(body.difficulty)) {
        return NextResponse.json({ error: "Neplatná obtížnost" }, { status: 400 });
      }
      data.difficulty = body.difficulty;
    }
    if (body.explanation !== undefined) data.explanation = String(body.explanation).trim() || null;
    if (body.source !== undefined) data.source = String(body.source).trim() || null;
    if (body.is_active !== undefined) data.is_active = !!body.is_active;
    data.updated_at = new Date();

    await prisma.questions.update({ where: { id }, data });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Training question PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání otázky" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireWrite();
  if (access instanceof NextResponse) return access;

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  try {
    const usage = await prisma.test_questions.count({ where: { question_id: id } });
    const answers = await prisma.test_answers.count({ where: { question_id: id } });

    if (usage > 0 || answers > 0) {
      // Otázka je použitá v testech/odpovědích – jen deaktivace, ať se nerozbijí výsledky
      await prisma.questions.update({ where: { id }, data: { is_active: false } });
      return NextResponse.json({ success: true, deactivated: true });
    }

    await prisma.questions.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: true });
  } catch (e) {
    console.error("Training question DELETE error:", e);
    return NextResponse.json({ error: "Chyba při mazání otázky" }, { status: 500 });
  }
}
