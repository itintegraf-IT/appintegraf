import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canWriteVykresy } from "@/lib/vykresy/access";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteVykresy(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.vykresy_machines.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Stroj nenalezen" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const name =
      typeof body.name === "string" ? body.name.trim() : existing.name;
    if (!name) {
      return NextResponse.json({ error: "Vyplňte název stroje." }, { status: 400 });
    }

    const sortOrder = Number(body.sort_order);
    const sort_order = Number.isFinite(sortOrder)
      ? Math.floor(sortOrder)
      : (existing.sort_order ?? 0);
    const is_active =
      body.is_active === undefined ? existing.is_active !== false : body.is_active !== false;

    const machine = await prisma.vykresy_machines.update({
      where: { id },
      data: {
        name: name.slice(0, 150),
        sort_order,
        is_active,
        updated_at: new Date(),
      },
      include: { _count: { select: { vykresy: true } } },
    });

    return NextResponse.json({ machine });
  } catch (e) {
    console.error("vykresy machines PUT:", e);
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteVykresy(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.vykresy_machines.findUnique({
    where: { id },
    include: { _count: { select: { vykresy: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Stroj nenalezen" }, { status: 404 });
  }

  // Pokud je stroj použit u výkresů, pouze deaktivovat
  if (existing._count.vykresy > 0) {
    const machine = await prisma.vykresy_machines.update({
      where: { id },
      data: { is_active: false, updated_at: new Date() },
      include: { _count: { select: { vykresy: true } } },
    });
    return NextResponse.json({
      machine,
      deactivated: true,
      message: "Stroj je použit u výkresů – byl deaktivován.",
    });
  }

  await prisma.vykresy_machines.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
