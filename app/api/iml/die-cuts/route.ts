import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { parseDieCutBody } from "@/lib/iml/die-cuts";
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
  const q = (url.searchParams.get("q") ?? url.searchParams.get("search") ?? "").trim();
  const includeInactive =
    url.searchParams.get("include_inactive") === "1" ||
    url.searchParams.get("include_inactive") === "true" ||
    url.searchParams.get("all") === "true";

  const where: Prisma.iml_die_cutsWhereInput = {
    ...(includeInactive ? {} : { is_active: true }),
    ...(q
      ? {
          OR: [
            { label_shape_code: { contains: q } },
            { die_cut_tool_code: { contains: q } },
            { assembly_code: { contains: q } },
            { note: { contains: q } },
          ],
        }
      : {}),
  };

  const rows = await prisma.iml_die_cuts.findMany({
    where,
    orderBy: [{ is_active: "desc" }, { label_shape_code: "asc" }],
    take: 1000,
    include: { _count: { select: { iml_products: true } } },
  });

  return NextResponse.json({
    die_cuts: rows.map(({ _count, ...row }) => ({
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
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám IML" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const parsed = parseDieCutBody(body);
    if ("error" in parsed) {
      return NextResponse.json(
        { error: parsed.error, field: parsed.field },
        { status: 400 }
      );
    }

    const existing = await prisma.iml_die_cuts.findUnique({
      where: { label_shape_code: parsed.label_shape_code },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: `Výsek s kódem tvaru „${parsed.label_shape_code}“ už existuje.`,
          field: "label_shape_code",
        },
        { status: 409 }
      );
    }

    const row = await prisma.iml_die_cuts.create({ data: parsed });
    await logImlAudit({
      userId,
      action: "create",
      tableName: "iml_die_cuts",
      recordId: row.id,
      newValues: row as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ die_cut: row }, { status: 201 });
  } catch (e) {
    console.error("POST /api/iml/die-cuts", e);
    return NextResponse.json({ error: "Chyba při vytváření výseku" }, { status: 500 });
  }
}
