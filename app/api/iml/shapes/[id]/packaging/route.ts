import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canEditImlPacking, canManageImlShapes } from "@/lib/iml-permissions";
import { parsePackagingBody } from "@/lib/iml/shape-tool-parse";

type Ctx = { params: Promise<{ id: string }> };

async function canEditShapePackaging(userId: number): Promise<boolean> {
  return (await canManageImlShapes(userId)) || (await canEditImlPacking(userId));
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const shapeId = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(shapeId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const shape = await prisma.iml_shape_catalog.findUnique({
    where: { id: shapeId },
    select: { id: true },
  });
  if (!shape) return NextResponse.json({ error: "Tvar nenalezen" }, { status: 404 });

  const rows = await prisma.iml_shape_material_packaging.findMany({
    where: { shape_id: shapeId },
    orderBy: { material_code: "asc" },
  });

  return NextResponse.json({ packaging: rows });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canEditShapePackaging(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const shapeId = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(shapeId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const shape = await prisma.iml_shape_catalog.findUnique({
    where: { id: shapeId },
    select: { id: true },
  });
  if (!shape) return NextResponse.json({ error: "Tvar nenalezen" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parsePackagingBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (parsed.box_type) {
    const box = await prisma.iml_box_types.findFirst({
      where: { code: parsed.box_type, is_active: true },
      select: { code: true },
    });
    if (!box) {
      return NextResponse.json(
        { error: "Typ krabice musí být z číselníku krabic." },
        { status: 400 }
      );
    }
  }

  try {
    const row = await prisma.iml_shape_material_packaging.create({
      data: { shape_id: shapeId, ...parsed },
    });
    return NextResponse.json({ success: true, packaging: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique") || msg.includes("Duplicate")) {
      return NextResponse.json(
        { error: `Materiál ${parsed.material_code} už u tvaru existuje.` },
        { status: 409 }
      );
    }
    console.error("POST packaging", e);
    return NextResponse.json({ error: "Uložení selhalo" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canEditShapePackaging(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const shapeId = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(shapeId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const rowId = body.id != null ? Number(body.id) : NaN;
  if (!Number.isFinite(rowId) || rowId < 1) {
    return NextResponse.json({ error: "Chybí id řádku matice." }, { status: 400 });
  }

  const parsed = parsePackagingBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (parsed.box_type) {
    const box = await prisma.iml_box_types.findFirst({
      where: { code: parsed.box_type, is_active: true },
      select: { code: true },
    });
    if (!box) {
      return NextResponse.json(
        { error: "Typ krabice musí být z číselníku krabic." },
        { status: 400 }
      );
    }
  }

  const existing = await prisma.iml_shape_material_packaging.findFirst({
    where: { id: rowId, shape_id: shapeId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Řádek matice nenalezen." }, { status: 404 });
  }

  try {
    const row = await prisma.iml_shape_material_packaging.update({
      where: { id: rowId },
      data: parsed,
    });
    return NextResponse.json({ success: true, packaging: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique") || msg.includes("Duplicate")) {
      return NextResponse.json(
        { error: `Materiál ${parsed.material_code} už u tvaru existuje.` },
        { status: 409 }
      );
    }
    console.error("PUT packaging", e);
    return NextResponse.json({ error: "Uložení selhalo" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canEditShapePackaging(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const shapeId = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(shapeId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const url = new URL(req.url);
  const rowId = parseInt(url.searchParams.get("id") ?? "", 10);
  if (Number.isNaN(rowId)) {
    return NextResponse.json({ error: "Chybí id řádku." }, { status: 400 });
  }

  const existing = await prisma.iml_shape_material_packaging.findFirst({
    where: { id: rowId, shape_id: shapeId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Řádek matice nenalezen." }, { status: 404 });
  }

  await prisma.iml_shape_material_packaging.delete({ where: { id: rowId } });
  return NextResponse.json({ success: true });
}
