import { requireCrmRead } from "@/lib/crm/guards";
import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/crm/api-utils";
import { prisma } from "@/lib/db";
import { NoteUpdateSchema } from "@/lib/crm/validators/note";
import { AppError } from "@/lib/crm/errors";
import { extractMentions } from "@/lib/crm/mentions";
import { toMentionUser } from "@/lib/crm/users";

async function load(id: string) {
  const note = await prisma.crm_notes.findUnique({ where: { id } });
  if (!note) throw new AppError("NOT_FOUND", "Poznámka nenalezena.");
  return note;
}

export const PATCH = withApiError(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireCrmRead();
  const { id } = await ctx.params;
  const existing = await load(id);
  if (user.role !== "ADMIN" && existing.author_id !== user.id) {
    throw new AppError("FORBIDDEN", "Edituj jen vlastní poznámky.");
  }
  const body: unknown = await req.json();
  const parsed = NoteUpdateSchema.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.message);
  const users = await prisma.users.findMany({
    select: { id: true, email: true, first_name: true, last_name: true },
  });
  const mentionIds = extractMentions(parsed.data.content, users.map(toMentionUser));
  const note = await prisma.crm_notes.update({
    where: { id: existing.id },
    data: { content: parsed.data.content, mentions: mentionIds },
  });
  return NextResponse.json({ note });
});

export const DELETE = withApiError(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireCrmRead();
  const { id } = await ctx.params;
  const existing = await load(id);
  if (user.role !== "ADMIN" && existing.author_id !== user.id) {
    throw new AppError("FORBIDDEN", "Smazat můžeš jen vlastní poznámky.");
  }
  await prisma.crm_notes.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
});
