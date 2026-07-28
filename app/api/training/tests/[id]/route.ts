import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

async function requireWrite(): Promise<{ userId: number } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění spravovat testy" }, { status: 403 });
  }
  return { userId };
}

/** Detail testu pro administraci (včetně správných odpovědí). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireWrite();
  if (access instanceof NextResponse) return access;

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const test = await prisma.tests.findUnique({
    where: { id },
    include: {
      test_questions: {
        include: {
          questions: {
            include: { question_categories: { select: { name: true, code: true, color: true } } },
          },
        },
        orderBy: { sort_order: "asc" },
      },
      test_assignments: {
        include: { user_groups: { select: { id: true, name: true } } },
      },
      _count: { select: { test_attempts: true } },
    },
  });

  if (!test) return NextResponse.json({ error: "Test nenalezen" }, { status: 404 });

  return NextResponse.json({ test });
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
    const existing = await prisma.tests.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Test nenalezen" }, { status: 404 });

    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Název nesmí být prázdný" }, { status: 400 });
      data.name = name;
    }
    if (body.description !== undefined) data.description = String(body.description).trim() || null;
    if (body.time_limit !== undefined) {
      data.time_limit = Math.min(180, Math.max(5, parseInt(String(body.time_limit), 10) || 30));
    }
    if (body.pass_percentage !== undefined) {
      data.pass_percentage = Math.min(100, Math.max(0, parseInt(String(body.pass_percentage), 10) || 0));
    }
    if (body.show_answers !== undefined) data.show_answers = !!body.show_answers;
    if (body.is_active !== undefined) data.is_active = !!body.is_active;
    data.updated_at = new Date();

    await prisma.tests.update({ where: { id }, data });

    // Přepsání seznamu otázek (pokud přišel)
    if (Array.isArray(body.question_ids)) {
      const validIds = body.question_ids
        .map((qid: unknown) => parseInt(String(qid), 10))
        .filter((qid: number) => !isNaN(qid));

      await prisma.$transaction([
        prisma.test_questions.deleteMany({ where: { test_id: id } }),
        prisma.test_questions.createMany({
          data: validIds.map((qId: number, idx: number) => ({
            test_id: id,
            question_id: qId,
            sort_order: idx,
          })),
        }),
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Training test PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání testu" }, { status: 500 });
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
    const attempts = await prisma.test_attempts.count({ where: { test_id: id } });

    if (attempts > 0) {
      // Test už někdo vyplnil – jen deaktivace, aby zůstala historie výsledků
      await prisma.tests.update({ where: { id }, data: { is_active: false } });
      return NextResponse.json({ success: true, deactivated: true });
    }

    await prisma.tests.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: true });
  } catch (e) {
    console.error("Training test DELETE error:", e);
    return NextResponse.json({ error: "Chyba při mazání testu" }, { status: 500 });
  }
}
