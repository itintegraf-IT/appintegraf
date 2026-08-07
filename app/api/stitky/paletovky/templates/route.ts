import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAdministerStitky, canReadStitky } from "@/lib/stitky/access";
import { logPaletovkaAudit } from "@/lib/stitky/paletovky/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadStitky(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const templates = await prisma.stitky_paletovka_templates.findMany({
    orderBy: { name: "asc" },
    take: 500,
    select: {
      id: true,
      name: true,
      layout_variant: true,
      blocks_per_page: true,
      source_filename: true,
      created_at: true,
    },
  });

  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerStitky(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Chybí název šablony" }, { status: 400 });
  }

  const row = await prisma.stitky_paletovka_templates.create({
    data: {
      name,
      layout_variant: String(b.layoutVariant ?? "single"),
      blocks_per_page: Number(b.blocksPerPage ?? 1),
      layout_json: b.layoutJson ?? {},
      defaults_json: b.defaultsJson ?? { blocks: [] },
      source_filename: b.sourceFilename != null ? String(b.sourceFilename) : null,
      created_by: userId,
    },
  });

  await logPaletovkaAudit({
    userId,
    recordId: row.id,
    tableName: "stitky_paletovka_templates",
    action: "TEMPLATE_CREATED",
    detail: { name },
  });

  return NextResponse.json({ template: row });
}
