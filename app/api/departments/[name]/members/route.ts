import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** GET – členové oddělení podle názvu (např. IT, Vedení) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const name = decodeURIComponent((await params).name);
  if (!name) {
    return NextResponse.json({ error: "Chybí název oddělení" }, { status: 400 });
  }

  const dept = await prisma.departments.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, is_active: true },
  });

  if (!dept) {
    return NextResponse.json({ members: [] });
  }

  const [mainUsers, secondaryUsers] = await Promise.all([
    prisma.users.findMany({
      where: { department_id: dept.id, is_active: true },
      select: { id: true, first_name: true, last_name: true, email: true },
    }),
    prisma.user_secondary_departments.findMany({
      where: { department_id: dept.id, users: { is_active: true } },
      include: {
        users: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
      },
    }),
  ]);

  const seen = new Set<number>();
  const members: { id: number; first_name: string; last_name: string; email: string }[] = [];

  for (const u of mainUsers) {
    if (!seen.has(u.id)) {
      seen.add(u.id);
      members.push(u);
    }
  }
  for (const s of secondaryUsers) {
    const u = s.users;
    if (u && !seen.has(u.id)) {
      seen.add(u.id);
      members.push(u);
    }
  }

  members.sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));

  return NextResponse.json({ members });
}
