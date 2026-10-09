import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canWriteTechnologie } from "@/lib/technologie/access";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteTechnologie(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.technologie_sheet_sizes.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Velikost nenalezena" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : existing.name;
    if (!name) {
      return NextResponse.json({ error: "Vyplňte velikost archu." }, { status: 400 });
    }

    const sortOrder = Number(body.sort_order);
    const sort_order = Number.isFinite(sortOrder)
      ? Math.floor(sortOrder)
      : (existing.sort_order ?? 0);
    const is_active =
      body.is_active === undefined ? existing.is_active !== false : body.is_active !== false;

    const item = await prisma.technologie_sheet_sizes.update({
      where: { id },
      data: {
        name: name.slice(0, 64),
        sort_order,
        is_active,
        updated_at: new Date(),
      },
      include: { _count: { select: { technologie: true } } },
    });

    return NextResponse.json({ item });
  } catch (e) {
    console.error("technologie sheet-sizes PUT:", e);
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
  if (!(await canWriteTechnologie(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.technologie_sheet_sizes.findUnique({
    where: { id },
    include: { _count: { select: { technologie: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Velikost nenalezena" }, { status: 404 });
  }

  if (existing._count.technologie > 0) {
    const item = await prisma.technologie_sheet_sizes.update({
      where: { id },
      data: { is_active: false, updated_at: new Date() },
      include: { _count: { select: { technologie: true } } },
    });
    return NextResponse.json({
      item,
      deactivated: true,
      message: "Velikost je použita u rozkresů – byla deaktivována.",
    });
  }

  await prisma.technologie_sheet_sizes.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
