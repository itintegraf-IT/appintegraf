import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const [tests, materials] = await Promise.all([
    prisma.tests.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
    prisma.learning_materials.findMany({
      orderBy: { title: "asc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({ tests, materials });
}
