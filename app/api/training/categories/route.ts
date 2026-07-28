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

  const categories = await prisma.question_categories.findMany({
    include: { _count: { select: { questions: true, learning_materials: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění spravovat kategorie" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const code = String(body.code ?? "").trim().toUpperCase();

    if (!name || !code) {
      return NextResponse.json({ error: "Vyplňte název a kód kategorie" }, { status: 400 });
    }

    const existing = await prisma.question_categories.findFirst({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: `Kategorie s kódem ${code} již existuje` }, { status: 400 });
    }

    const created = await prisma.question_categories.create({
      data: {
        name,
        code,
        description: String(body.description ?? "").trim() || null,
        color: /^#[0-9a-fA-F]{6}$/.test(String(body.color ?? "")) ? String(body.color) : undefined,
        is_active: body.is_active !== false,
      },
    });

    return NextResponse.json({ success: true, id: created.id });
  } catch (e) {
    console.error("Training category POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření kategorie" }, { status: 500 });
  }
}
