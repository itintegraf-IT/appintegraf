import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const materials = await prisma.learning_materials.findMany({
    include: { question_categories: { select: { id: true, name: true, code: true, color: true } } },
    orderBy: { title: "asc" },
  });

  return NextResponse.json({ materials });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění spravovat materiály" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    const content = String(body.content ?? "").trim();

    if (!title || !content) {
      return NextResponse.json({ error: "Vyplňte název a obsah materiálu" }, { status: 400 });
    }

    const categoryId = parseInt(String(body.category_id), 10);

    const created = await prisma.learning_materials.create({
      data: {
        title,
        content,
        category_id: isNaN(categoryId) ? null : categoryId,
        source: String(body.source ?? "").trim() || null,
      },
    });

    return NextResponse.json({ success: true, id: created.id });
  } catch (e) {
    console.error("Training material POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření materiálu" }, { status: 500 });
  }
}
