import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageImlShapes } from "@/lib/iml-permissions";
import { parseAssignmentBody } from "@/lib/iml/shape-tool-parse";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageImlShapes(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const shapeId = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(shapeId)) {
    return NextResponse.json({ error: "Neplatné ID tvaru" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseAssignmentBody({ ...body, shape_id: shapeId });
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const assignment = await prisma.iml_shape_tool_assignment.create({
      data: parsed,
      include: { tool: true },
    });
    return NextResponse.json({ success: true, assignment });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique") || msg.includes("Duplicate")) {
      return NextResponse.json(
        { error: "Tento nástroj nebo priorita už je u tvaru přiřazena." },
        { status: 409 }
      );
    }
    console.error("POST assignments", e);
    return NextResponse.json({ error: "Uložení selhalo" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageImlShapes(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const shapeId = parseInt((await ctx.params).id, 10);
  const assignmentId = parseInt(
    new URL(req.url).searchParams.get("assignment_id") ?? "",
    10
  );
  if (Number.isNaN(shapeId) || Number.isNaN(assignmentId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  await prisma.iml_shape_tool_assignment.deleteMany({
    where: { id: assignmentId, shape_id: shapeId },
  });
  return NextResponse.json({ success: true });
}
