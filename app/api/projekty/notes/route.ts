import { NextRequest, NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { prisma } from "@/lib/projekty/prisma";
import { NoteCreateSchema } from "@/lib/projekty/validators/note";
import { AppError } from "@/lib/projekty/errors";
import { canEditCard, canViewCard } from "@/lib/projekty/rbac";
import { loadCardForRBAC } from "@/lib/projekty/board-rbac";
import { extractMentions } from "@/lib/projekty/mentions";
import { projektyUserSelect, toDisplayUser } from "@/lib/projekty/user-display";
import { notifyProjektyMentions, plainPreview, cardBoardContext } from "@/lib/projekty/notify";
import type { ParentType } from "@prisma/client";

export const GET = withApiError(async (req: NextRequest) => {
  const user = await requireSession();
  const url = new URL(req.url);
  const parentType = url.searchParams.get("parentType") as ParentType | null;
  const parentId = url.searchParams.get("parentId");
  if (!parentType || !parentId) throw new AppError("VALIDATION", "parentType a parentId jsou povinné.");
  // Jediný podporovaný parent je CARD (jinak by neplatná enum hodnota shodila dotaz 500
  // a obešla RBAC kontrolu níže).
  if (parentType !== "CARD") throw new AppError("VALIDATION", "Nepodporovaný parentType.");
  const card = await loadCardForRBAC(parentId);
  if (!canViewCard(user, card)) throw new AppError("FORBIDDEN", "Nemáš přístup k této kartě.");
  const rawNotes = await prisma.note.findMany({
    where: { parentType, parentId },
    include: { author: { select: projektyUserSelect } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const notes = rawNotes.map((n) => ({
    ...n,
    author: n.author ? toDisplayUser(n.author) : null,
  }));
  return NextResponse.json({ notes });
});

export const POST = withApiError(async (req: NextRequest) => {
  const user = await requireSession();
  if (user.role === "VIEWER") throw new AppError("FORBIDDEN", "Viewer nemůže přidávat poznámky.");
  const body: unknown = await req.json();
  const parsed = NoteCreateSchema.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.message);
  if (parsed.data.parentType === "CARD") {
    const card = await loadCardForRBAC(parsed.data.parentId);
    if (!canEditCard(user, card)) throw new AppError("FORBIDDEN", "Nemůžeš přidávat poznámky k této kartě.");
  }
  const users = (await prisma.users.findMany({ select: projektyUserSelect })).map(toDisplayUser);
  const mentionIds = extractMentions(parsed.data.content, users);
  const db = getPrismaAudited(user.id);
  const raw = await db.note.create({
    data: {
      parentType: parsed.data.parentType,
      parentId: parsed.data.parentId,
      content: parsed.data.content,
      authorId: user.id,
      mentions: mentionIds,
    },
    // Vracet `author` ve stejném tvaru jako GET — jinak komponenta zobrazí čerstvý
    // komentář bez jména/avataru (fallback „—") až do znovunačtení karty.
    include: { author: { select: projektyUserSelect } },
  });
  const note = { ...raw, author: raw.author ? toDisplayUser(raw.author) : null };
  // Doručení @zmínek do appintegraf zvonečku (in-app). Best-effort — notify je resilientní.
  if (parsed.data.parentType === "CARD" && mentionIds.length > 0) {
    const ctx = await cardBoardContext(parsed.data.parentId);
    if (ctx) {
      // Notifikovat jen zmíněné s přístupem k boardu — obsah nesmí uniknout nečlenovi.
      const recipients = mentionIds.filter((mid) => ctx.viewerIds.has(mid));
      if (recipients.length > 0) {
        await notifyProjektyMentions({
          mentionUserIds: recipients,
          actorId: user.id,
          boardId: ctx.boardId,
          cardId: parsed.data.parentId,
          cardTitle: ctx.title,
          preview: plainPreview(parsed.data.content),
        });
      }
    }
  }
  return NextResponse.json({ note }, { status: 201 });
});
