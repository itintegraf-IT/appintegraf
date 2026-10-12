import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canManageImlTools } from "@/lib/iml-permissions";
import { parseToolBody } from "@/lib/iml/shape-tool-parse";
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
  const technology = (url.searchParams.get("technology") ?? "").trim();
  const status = (url.searchParams.get("status") ?? "").trim();

  const where: Prisma.iml_tool_catalogWhereInput = {
    ...(technology ? { technology } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { tool_code_new: { contains: q } },
            { tool_code_orig: { contains: q } },
            { note: { contains: q } },
          ],
        }
      : {}),
  };

  const tools = await prisma.iml_tool_catalog.findMany({
    where,
    orderBy: { tool_code_new: "asc" },
    take: 1000,
    include: {
      impositions: { orderBy: { imposition_code: "asc" } },
      _count: { select: { iml_products: true, shape_assignments: true } },
    },
  });

  return NextResponse.json({
    tools: tools.map(({ _count, ...row }) => ({
      ...row,
      products_count: _count.iml_products,
      shapes_count: _count.shape_assignments,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageImlTools(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění spravovat nástroje" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseToolBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const created = await prisma.iml_tool_catalog.create({ data: parsed });
    return NextResponse.json({ success: true, tool: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique") || msg.includes("Duplicate")) {
      return NextResponse.json({ error: "Nový kód nástroje už existuje." }, { status: 409 });
    }
    console.error("POST /api/iml/tools", e);
    return NextResponse.json({ error: "Uložení selhalo" }, { status: 500 });
  }
}
