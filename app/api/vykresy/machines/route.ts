import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadVykresy, canWriteVykresy } from "@/lib/vykresy/access";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadVykresy(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const activeOnly = req.nextUrl.searchParams.get("active") !== "false";

  const machines = await prisma.vykresy_machines.findMany({
    where: activeOnly ? { is_active: true } : undefined,
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    include: { _count: { select: { vykresy: true } } },
  });

  return NextResponse.json({ machines });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteVykresy(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Vyplňte název stroje." }, { status: 400 });
    }

    const sortOrder = Number(body.sort_order);
    const sort_order = Number.isFinite(sortOrder) ? Math.floor(sortOrder) : 0;
    const is_active = body.is_active !== false;

    const machine = await prisma.vykresy_machines.create({
      data: {
        name: name.slice(0, 150),
        sort_order,
        is_active,
      },
      include: { _count: { select: { vykresy: true } } },
    });

    return NextResponse.json({ machine });
  } catch (e) {
    console.error("vykresy machines POST:", e);
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 500 });
  }
}
