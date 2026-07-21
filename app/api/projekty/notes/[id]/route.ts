import { NextRequest, NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { prisma } from "@/lib/projekty/prisma";
import { NoteUpdateSchema } from "@/lib/projekty/validators/note";
import { AppError } from "@/lib/projekty/errors";
import { canViewCard } from "@/lib/projekty/rbac";
import { loadCardForRBAC } from "@/lib/projekty/board-rbac";
import { extractMentions } from "@/lib/projekty/mentions";
import { projektyUserSelect, toDisplayUser } from "@/lib/projekty/user-display";

async function load(id: string) {
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) throw new AppError("NOT_FOUND", "Poznámka nenalezena.");
  return note;
}

export const PATCH = withApiError(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSession();
  const { id } = await ctx.params;
  const existing = await load(id);
  if (existing.parentType === "CARD") {
    const card = await loadCardForRBAC(existing.parentId);
    if (!canViewCard(user, card)) throw new AppError("FORBIDDEN", "Nemáš přístup k této kartě.");
  }
  if (user.role !== "ADMIN" && existing.authorId !== user.id) {
    throw new AppError("FORBIDDEN", "Edituj jen vlastní poznámky.");
  }
  const body: unknown = await req.json();
  const parsed = NoteUpdateSchema.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.message);
  const users = (await prisma.users.findMany({ select: projektyUserSelect })).map(toDisplayUser);
  const mentionIds = extractMentions(parsed.data.content, users);
  const db = getPrismaAudited(user.id);
  const note = await db.note.update({
    where: { id: existing.id },
    data: { content: parsed.data.content, mentions: mentionIds },
  });
  return NextResponse.json({ note });
});

export const DELETE = withApiError(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSession();
  const { id } = await ctx.params;
  const existing = await load(id);
  if (existing.parentType === "CARD") {
    const card = await loadCardForRBAC(existing.parentId);
    if (!canViewCard(user, card)) throw new AppError("FORBIDDEN", "Nemáš přístup k této kartě.");
  }
  if (user.role !== "ADMIN" && existing.authorId !== user.id) {
    throw new AppError("FORBIDDEN", "Smazat můžeš jen vlastní poznámky.");
  }
  const db = getPrismaAudited(user.id);
  await db.note.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
});
