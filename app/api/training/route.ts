import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getVisibleTestsForUser } from "@/lib/training/access";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);

  const [tests, materials] = await Promise.all([
    getVisibleTestsForUser(userId),
    prisma.learning_materials.findMany({
      include: { question_categories: { select: { name: true, code: true, color: true } } },
      orderBy: { title: "asc" },
      take: 100,
    }),
  ]);

  return NextResponse.json({ tests, materials });
}
