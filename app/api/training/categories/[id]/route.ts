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
    return NextResponse.json({ error: "Nemáte oprávnění spravovat kategorie" }, { status: 403 });
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
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Název nesmí být prázdný" }, { status: 400 });
      data.name = name;
    }
    if (body.code !== undefined) {
      const code = String(body.code).trim().toUpperCase();
      if (!code) return NextResponse.json({ error: "Kód nesmí být prázdný" }, { status: 400 });
      const existing = await prisma.question_categories.findFirst({
        where: { code, id: { not: id } },
      });
      if (existing) {
        return NextResponse.json({ error: `Kategorie s kódem ${code} již existuje` }, { status: 400 });
      }
      data.code = code;
    }
    if (body.description !== undefined) data.description = String(body.description).trim() || null;
    if (body.color !== undefined && /^#[0-9a-fA-F]{6}$/.test(String(body.color))) {
      data.color = String(body.color);
    }
    if (body.is_active !== undefined) data.is_active = !!body.is_active;

    await prisma.question_categories.update({ where: { id }, data });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Training category PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání kategorie" }, { status: 500 });
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
    const [questions, materials] = await Promise.all([
      prisma.questions.count({ where: { category_id: id } }),
      prisma.learning_materials.count({ where: { category_id: id } }),
    ]);

    if (questions > 0 || materials > 0) {
      return NextResponse.json(
        { error: `Kategorii nelze smazat – obsahuje ${questions} otázek a ${materials} materiálů. Nejprve je přesuňte nebo smažte.` },
        { status: 400 }
      );
    }

    await prisma.question_categories.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Training category DELETE error:", e);
    return NextResponse.json({ error: "Chyba při mazání kategorie" }, { status: 500 });
  }
}
