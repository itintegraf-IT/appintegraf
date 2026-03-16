import { NextResponse } from "next/server";
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

  const [questions, categories] = await Promise.all([
    prisma.questions.findMany({
      where: { is_active: true },
      include: { question_categories: { select: { name: true, code: true } } },
      orderBy: { category_id: "asc" },
      take: 200,
    }),
    prisma.question_categories.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({ questions, categories });
}
