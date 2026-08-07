import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAdministerStitky, canReadStitky } from "@/lib/stitky/access";
import { logPaletovkaAudit } from "@/lib/stitky/paletovky/audit";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadStitky(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const row = await prisma.stitky_paletovka_templates.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Šablona nenalezena" }, { status: 404 });
  }

  return NextResponse.json({ template: row });
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerStitky(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const row = await prisma.stitky_paletovka_templates.update({
    where: { id },
    data: {
      ...(b.name != null ? { name: String(b.name).trim() } : {}),
      ...(b.defaultsJson != null ? { defaults_json: b.defaultsJson } : {}),
      ...(b.layoutJson != null ? { layout_json: b.layoutJson } : {}),
    },
  });

  await logPaletovkaAudit({
    userId,
    recordId: id,
    tableName: "stitky_paletovka_templates",
    action: "TEMPLATE_UPDATED",
  });

  return NextResponse.json({ template: row });
}
