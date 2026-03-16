import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const departments = await prisma.departments.findMany({
    where: { is_active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  return NextResponse.json(departments);
}
