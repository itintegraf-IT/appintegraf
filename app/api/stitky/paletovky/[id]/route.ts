import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  canAdministerStitky,
  canReadStitky,
  canWriteStitkyOrder,
} from "@/lib/stitky/access";
import { logPaletovkaAudit } from "@/lib/stitky/paletovky/audit";
import { parsePaletovkaDocumentData } from "@/lib/stitky/paletovky/types";

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

  const row = await prisma.stitky_paletovky.findUnique({
    where: { id },
    include: {
      template: true,
      users_creator: { select: { first_name: true, last_name: true } },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Paletovka nenalezena" }, { status: 404 });
  }

  return NextResponse.json({ paletovka: row });
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteStitkyOrder(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.stitky_paletovky.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Paletovka nenalezena" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const title = b.title != null ? String(b.title).trim() : undefined;
  const data = b.data != null ? parsePaletovkaDocumentData(b.data) : undefined;
  const status = b.status != null ? String(b.status) : undefined;

  if (data === null) {
    return NextResponse.json({ error: "Neplatná data paletovky" }, { status: 400 });
  }

  const row = await prisma.stitky_paletovky.update({
    where: { id },
    data: {
      ...(title ? { title } : {}),
      ...(data ? { data_json: data } : {}),
      ...(status === "DRAFT" || status === "PRINTED" ? { status } : {}),
    },
    include: { template: true },
  });

  await logPaletovkaAudit({ userId, recordId: id, action: "UPDATED" });

  return NextResponse.json({ paletovka: row });
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
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

  const existing = await prisma.stitky_paletovky.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Paletovka nenalezena" }, { status: 404 });
  }

  const canDelete =
    (await canAdministerStitky(userId)) ||
    (existing.created_by === userId && existing.status === "DRAFT");
  if (!canDelete) {
    return NextResponse.json({ error: "Nemáte oprávnění smazat" }, { status: 403 });
  }

  await logPaletovkaAudit({
    userId,
    recordId: id,
    action: "DELETED",
    detail: { title: existing.title },
  });
  await prisma.stitky_paletovky.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
