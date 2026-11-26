import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canManageImlImpositions } from "@/lib/iml-permissions";
import { parseImpositionBody } from "@/lib/iml/shape-tool-parse";
import {
  assertImpositionCodeAvailable,
  IMPOSITION_INCLUDE,
  replaceImpositionShapes,
  resolveCutOnlyAllowed,
} from "@/lib/iml/imposition-shapes";
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
  const shapeIdRaw = url.searchParams.get("shape_id");
  const shapeId = shapeIdRaw ? parseInt(shapeIdRaw, 10) : null;
  const q = (url.searchParams.get("q") ?? "").trim();

  const where: Prisma.iml_imposition_catalogWhereInput = {
    ...(toolId != null && !Number.isNaN(toolId) ? { tool_id: toolId } : {}),
    ...(shapeId != null && !Number.isNaN(shapeId)
      ? { shapes: { some: { shape_id: shapeId } } }
      : {}),
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
    orderBy: [{ imposition_code: "asc" }],
    take: 2000,
    include: IMPOSITION_INCLUDE,
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

  const codeErr = await assertImpositionCodeAvailable(parsed.imposition_code);
  if (codeErr) return NextResponse.json({ error: codeErr }, { status: 400 });

  const cutCheck = await resolveCutOnlyAllowed({
    is_cut_only: parsed.is_cut_only,
    die_cut_device_id: parsed.die_cut_device_id,
    tool_id: parsed.tool_id,
  });
  if ("error" in cutCheck) {
    return NextResponse.json({ error: cutCheck.error }, { status: 400 });
  }

  const { shapes, ...header } = parsed;

  try {
    const created = await prisma.iml_imposition_catalog.create({ data: header });
    if (shapes.length > 0) {
      await replaceImpositionShapes(created.id, shapes);
    }
    const imposition = await prisma.iml_imposition_catalog.findUnique({
      where: { id: created.id },
      include: IMPOSITION_INCLUDE,
    });
    return NextResponse.json({ success: true, imposition });
  } catch (e) {
    console.error("POST /api/iml/impositions", e);
    return NextResponse.json({ error: "Uložení selhalo" }, { status: 500 });
  }
}
