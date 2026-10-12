import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageImlShapes } from "@/lib/iml-permissions";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageImlShapes(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = body.name != null ? String(body.name).trim().slice(0, 100) : "";
  if (!name) {
    return NextResponse.json({ error: "Název je povinný." }, { status: 400 });
  }
  const is_active =
    body.is_active !== false && body.is_active !== "false" && body.is_active !== 0;
  const sort_order =
    body.sort_order != null && body.sort_order !== ""
      ? parseInt(String(body.sort_order), 10)
      : undefined;

  try {
    const shape_type = await prisma.iml_shape_types.update({
      where: { id },
      data: {
        name,
        is_active,
        ...(sort_order != null && Number.isFinite(sort_order) ? { sort_order } : {}),
      },
    });
    return NextResponse.json({ success: true, shape_type });
  } catch (e) {
    console.error("PUT shape-types", e);
    return NextResponse.json({ error: "Uložení selhalo" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageImlShapes(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const row = await prisma.iml_shape_types.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Typ nenalezen" }, { status: 404 });

  const inUse = await prisma.iml_shape_catalog.count({
    where: { shape_type: row.code },
  });
  if (inUse > 0) {
    await prisma.iml_shape_types.update({
      where: { id },
      data: { is_active: false },
    });
    return NextResponse.json({
      success: true,
      deactivated: true,
      message: "Typ je použitý u tvarů — deaktivován místo smazání.",
    });
  }

  await prisma.iml_shape_types.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
