import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canManageImlImpositions } from "@/lib/iml-permissions";
import { parseImpositionBody } from "@/lib/iml/shape-tool-parse";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const url = new URL(req.url);
  const toolIdRaw = url.searchParams.get("tool_id");
  const toolId = toolIdRaw ? parseInt(toolIdRaw, 10) : null;
  const q = (url.searchParams.get("q") ?? "").trim();

  const where: Prisma.iml_imposition_catalogWhereInput = {
    ...(toolId != null && !Number.isNaN(toolId) ? { tool_id: toolId } : {}),
    ...(q
      ? {
          OR: [
            { imposition_code: { contains: q } },
            { description: { contains: q } },
          ],
        }
      : {}),
  };

  const impositions = await prisma.iml_imposition_catalog.findMany({
    where,
    orderBy: [{ tool_id: "asc" }, { imposition_code: "asc" }],
    take: 2000,
    include: {
      tool: {
        select: { id: true, tool_code_new: true, tool_code_orig: true, technology: true },
      },
    },
  });

  return NextResponse.json({ impositions });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageImlImpositions(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění spravovat montáže" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseImpositionBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const created = await prisma.iml_imposition_catalog.create({ data: parsed });
    return NextResponse.json({ success: true, imposition: created });
  } catch (e) {
    console.error("POST /api/iml/impositions", e);
    return NextResponse.json({ error: "Uložení selhalo" }, { status: 500 });
  }
}
