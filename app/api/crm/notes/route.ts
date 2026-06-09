import { requireCrmRead } from "@/lib/crm/guards";
import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/crm/api-utils";
import { prisma } from "@/lib/db";
import { NoteCreateSchema } from "@/lib/crm/validators/note";
import { AppError } from "@/lib/crm/errors";
import { canAccessParent } from "@/lib/crm/rbac";
import { extractMentions } from "@/lib/crm/mentions";
import { toMentionUser } from "@/lib/crm/users";
import type { crm_parent_type } from "@prisma/client";

export const GET = withApiError(async (req: NextRequest) => {
  const user = await requireCrmRead();
  const url = new URL(req.url);
  const parent_type = url.searchParams.get("parent_type") as crm_parent_type | null;
  const parent_id = url.searchParams.get("parent_id");
  if (!parent_type || !parent_id) throw new AppError("VALIDATION", "parent_type a parent_id jsou povinné.");
  const ok = await canAccessParent(user, parent_type, parent_id);
  if (!ok) throw new AppError("FORBIDDEN", "Nemáš přístup.");
  const notes = await prisma.crm_notes.findMany({
    where: { parent_type, parent_id },
    include: { author: { select: { id: true, first_name: true, last_name: true, email: true } } },
    orderBy: { created_at: "desc" },
    take: 200,
  });
  return NextResponse.json({ notes });
});

export const POST = withApiError(async (req: NextRequest) => {
  const user = await requireCrmRead();
  if (user.role === "VIEWER") throw new AppError("FORBIDDEN", "Viewer nemůže přidávat poznámky.");
  const body: unknown = await req.json();
  const parsed = NoteCreateSchema.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.message);
  const ok = await canAccessParent(user, parsed.data.parent_type, parsed.data.parent_id, "write");
  if (!ok) throw new AppError("FORBIDDEN", "Nemáš přístup.");
  const users = await prisma.users.findMany({
    select: { id: true, email: true, first_name: true, last_name: true },
  });
  const mentionIds = extractMentions(parsed.data.content, users.map(toMentionUser));
  const note = await prisma.crm_notes.create({
    data: {
      parent_type: parsed.data.parent_type,
      parent_id: parsed.data.parent_id,
      content: parsed.data.content,
      author_id: user.id,
      mentions: mentionIds,
    },
  });
  if (mentionIds.length > 0) {
    const author = await prisma.users.findUnique({
      where: { id: user.id },
      select: { email: true },
    });
    await prisma.crm_notifications.createMany({
      data: mentionIds
        .filter((id) => id !== user.id)
        .map((mentionedUserId) => ({
          user_id: mentionedUserId,
          type: "MENTION",
          payload: {
            noteId: note.id,
            parent_type: note.parent_type,
            parent_id: note.parent_id,
            authorEmail: author?.email ?? null,
          },
        })),
    });
  }
  return NextResponse.json({ note }, { status: 201 });
});
