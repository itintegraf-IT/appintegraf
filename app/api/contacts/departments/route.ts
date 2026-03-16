import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const departments = await prisma.users.findMany({
    where: { is_active: true, department_name: { not: null } },
    select: { department_name: true },
    distinct: ["department_name"],
  });

  const names = [...new Set(departments.map((d) => d.department_name).filter(Boolean))] as string[];
  names.sort();

  return NextResponse.json(names);
}
