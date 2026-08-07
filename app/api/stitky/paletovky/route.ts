import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAdministerStitky, canReadStitky, canWriteStitkyOrder } from "@/lib/stitky/access";
import { logPaletovkaAudit } from "@/lib/stitky/paletovky/audit";
import { parsePaletovkaDocumentData } from "@/lib/stitky/paletovky/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadStitky(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const mineOnly = req.nextUrl.searchParams.get("mine") === "1";
  const isAdmin = await canAdministerStitky(userId);

  const rows = await prisma.stitky_paletovky.findMany({
    where: mineOnly && !isAdmin ? { created_by: userId } : undefined,
    orderBy: { updated_at: "desc" },
    take: 200,
    include: {
      template: { select: { id: true, name: true, layout_variant: true } },
      users_creator: { select: { first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({ paletovky: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteStitkyOrder(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const templateId = parseInt(String(b.templateId ?? ""), 10);
  const title = String(b.title ?? "").trim();
  const data = parsePaletovkaDocumentData(b.data);

  if (Number.isNaN(templateId) || !title || !data) {
    return NextResponse.json({ error: "Chybí templateId, title nebo data" }, { status: 400 });
  }

  const template = await prisma.stitky_paletovka_templates.findUnique({
    where: { id: templateId },
  });
  if (!template) {
    return NextResponse.json({ error: "Šablona nenalezena" }, { status: 404 });
  }

  const row = await prisma.stitky_paletovky.create({
    data: {
      template_id: templateId,
      title,
      data_json: data,
      created_by: userId,
    },
    include: {
      template: { select: { id: true, name: true, layout_variant: true } },
    },
  });

  await logPaletovkaAudit({
    userId,
    recordId: row.id,
    action: "CREATED",
    detail: { title, template_id: templateId },
  });

  return NextResponse.json({ paletovka: row });
}
