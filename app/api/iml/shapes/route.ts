import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canManageImlShapes } from "@/lib/iml-permissions";
import { parseShapeBody } from "@/lib/iml/shape-tool-parse";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k modulu IML" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const shapeType = (url.searchParams.get("shape_type") ?? "").trim();

  const where: Prisma.iml_shape_catalogWhereInput = {
    ...(shapeType ? { shape_type: shapeType } : {}),
    ...(q
      ? {
          OR: [
            { shape_code: { contains: q } },
            { internal_note: { contains: q } },
          ],
        }
      : {}),
  };

  const shapes = await prisma.iml_shape_catalog.findMany({
    where,
    orderBy: { shape_code: "asc" },
    take: 1000,
    include: {
      tool_assignments: {
        include: {
          tool: {
            select: {
              id: true,
              tool_code_new: true,
              tool_code_orig: true,
              technology: true,
              status: true,
            },
          },
        },
        orderBy: { priority: "asc" },
      },
      _count: { select: { iml_products: true } },
    },
  });

  return NextResponse.json({
    shapes: shapes.map(({ _count, ...row }) => ({
      ...row,
      products_count: _count.iml_products,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageImlShapes(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění spravovat tvary" }, { status: 403 });
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
      { error: `Typ tvaru „${parsed.shape_type}“ neexistuje nebo není aktivní. Přidejte ho v číselníku typů.` },
      { status: 400 }
    );
  }

  try {
    const created = await prisma.iml_shape_catalog.create({ data: parsed });
    return NextResponse.json({ success: true, shape: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique") || msg.includes("Duplicate")) {
      return NextResponse.json({ error: "Kód tvaru už existuje." }, { status: 409 });
    }
    console.error("POST /api/iml/shapes", e);
    return NextResponse.json({ error: "Uložení selhalo" }, { status: 500 });
  }
}
