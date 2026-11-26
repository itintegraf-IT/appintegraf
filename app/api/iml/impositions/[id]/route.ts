import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageImlImpositions } from "@/lib/iml-permissions";
import { parseImpositionBody } from "@/lib/iml/shape-tool-parse";
import { resyncProductsForImposition } from "@/lib/iml/product-shape-sync";
import {
  assertImpositionCodeAvailable,
  IMPOSITION_INCLUDE,
  replaceImpositionShapes,
  resolveCutOnlyAllowed,
} from "@/lib/iml/imposition-shapes";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const imposition = await prisma.iml_imposition_catalog.findUnique({
    where: { id },
    include: IMPOSITION_INCLUDE,
  });
  if (!imposition) {
    return NextResponse.json({ error: "Montáž nenalezena" }, { status: 404 });
  }
  return NextResponse.json({ imposition });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageImlImpositions(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseImpositionBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const codeErr = await assertImpositionCodeAvailable(parsed.imposition_code, id);
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
    await prisma.iml_imposition_catalog.update({
      where: { id },
      data: header,
    });
    await replaceImpositionShapes(id, shapes);
    const updatedProducts = await resyncProductsForImposition(id);
    const imposition = await prisma.iml_imposition_catalog.findUnique({
      where: { id },
      include: IMPOSITION_INCLUDE,
    });
    return NextResponse.json({ success: true, imposition, updatedProducts });
  } catch (e) {
    console.error("PUT /api/iml/impositions/[id]", e);
    return NextResponse.json({ error: "Uložení selhalo" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageImlImpositions(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  try {
    await prisma.iml_imposition_catalog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE imposition", e);
    return NextResponse.json({ error: "Smazání selhalo" }, { status: 400 });
  }
}
