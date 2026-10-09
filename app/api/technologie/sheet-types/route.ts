import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadTechnologie, canWriteTechnologie } from "@/lib/technologie/access";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadTechnologie(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const activeOnly = req.nextUrl.searchParams.get("active") !== "false";

  const items = await prisma.technologie_sheet_types.findMany({
    where: activeOnly ? { is_active: true } : undefined,
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    include: { _count: { select: { technologie: true } } },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteTechnologie(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Vyplňte název typu." }, { status: 400 });
    }

    const sortOrder = Number(body.sort_order);
    const sort_order = Number.isFinite(sortOrder) ? Math.floor(sortOrder) : 0;
    const is_active = body.is_active !== false;

    const item = await prisma.technologie_sheet_types.create({
      data: {
        name: name.slice(0, 150),
        sort_order,
        is_active,
      },
      include: { _count: { select: { technologie: true } } },
    });

    return NextResponse.json({ item });
  } catch (e) {
    console.error("technologie sheet-types POST:", e);
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 500 });
  }
}
