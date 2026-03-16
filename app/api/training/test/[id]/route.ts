import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const test = await prisma.tests.findUnique({
    where: { id, is_active: true },
    include: {
      test_questions: {
        include: {
          questions: {
            select: {
              id: true,
              question: true,
              option_a: true,
              option_b: true,
              option_c: true,
              option_d: true,
            },
          },
        },
        orderBy: { sort_order: "asc" },
      },
    },
  });

  if (!test) {
    return NextResponse.json({ error: "Test nenalezen" }, { status: 404 });
  }

  return NextResponse.json(test);
}
