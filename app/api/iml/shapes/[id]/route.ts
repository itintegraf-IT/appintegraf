import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canManageImlShapes } from "@/lib/iml-permissions";
import { parseShapeBody } from "@/lib/iml/shape-tool-parse";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const shape = await prisma.iml_shape_catalog.findUnique({
    where: { id },
    include: {
      tool_assignments: {
        include: {
          tool: true,
        },
        orderBy: { priority: "asc" },
      },
    },
  });
  if (!shape) return NextResponse.json({ error: "Tvar nenalezen" }, { status: 404 });
  return NextResponse.json({ shape });
}

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
  const parsed = parseShapeBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const typeOk = await prisma.iml_shape_types.findFirst({
    where: { code: parsed.shape_type, is_active: true },
    select: { id: true },
  });
  if (!typeOk) {
    return NextResponse.json(
      {
        error: `Typ tvaru „${parsed.shape_type}“ neexistuje nebo není aktivní. Přidejte ho v číselníku typů.`,
      },
      { status: 400 }
    );
  }

  try {
    const shape = await prisma.iml_shape_catalog.update({
      where: { id },
      data: parsed,
    });
    return NextResponse.json({ success: true, shape });
  } catch (e) {
    console.error("PUT /api/iml/shapes/[id]", e);
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

  try {
    await prisma.iml_shape_catalog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/iml/shapes/[id]", e);
    return NextResponse.json({ error: "Smazání selhalo (tvar je používaný?)" }, { status: 400 });
  }
}
