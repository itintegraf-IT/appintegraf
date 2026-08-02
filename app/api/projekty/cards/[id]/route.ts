import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { loadCardForRBAC, loadCardForFullDetail } from "@/lib/projekty/board-rbac";
import { canViewCard, canEditCard } from "@/lib/projekty/rbac";
import { CardUpdateSchema } from "@/lib/projekty/validators/card";
import { notifyProjektyCardDueDateChanged } from "@/lib/projekty/notify";

type Params = { params: Promise<{ id: string }> };

export const GET = withApiError(async (_req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  const cardForRbac = await loadCardForRBAC(id);
  if (!canViewCard(user, cardForRbac)) {
    throw new AppError("FORBIDDEN", "Nemáš přístup k této kartě.");
  }

  const card = await loadCardForFullDetail(id);
  return NextResponse.json({ card });
});

export const PATCH = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  const card = await loadCardForRBAC(id);
  if (!canEditCard(user, card)) {
    throw new AppError("FORBIDDEN", "Nemůžeš editovat tuto kartu.");
  }

  const body: unknown = await req.json();
  const parsed = CardUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  // Convert ISO datetime strings → Date objects
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.dueDate !== undefined) {
    data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  }
  if (parsed.data.startDate !== undefined) {
    data.startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
  }

  // Při změně termínu si předem načti stav pro porovnání + příjemce (členy karty).
  const dueDateProvided = parsed.data.dueDate !== undefined;
  let dueCtx: { boardId: string; title: string; memberIds: number[]; oldDue: Date | null } | null = null;
  if (dueDateProvided) {
    const before = await prisma.card.findUnique({
      where: { id },
      select: { boardId: true, title: true, dueDate: true, members: { select: { userId: true } } },
    });
    if (before) {
      const board = await prisma.board.findUnique({
        where: { id: before.boardId },
        select: { ownerId: true, members: { select: { userId: true } } },
      });
      const viewerIds = new Set<number>(
        board ? [board.ownerId, ...board.members.map((m) => m.userId)] : [],
      );
      dueCtx = {
        boardId: before.boardId,
        title: before.title,
        // Jen členové karty, kteří stále mají přístup k boardu (ne bývalí členové).
        memberIds: before.members.map((m) => m.userId).filter((uid) => viewerIds.has(uid)),
        oldDue: before.dueDate,
      };
    }
  }

  const audited = getPrismaAudited(user.id);
  const updated = await audited.card.update({ where: { id }, data });

  // Notifikace o změně termínu členům karty — jen když se termín reálně změnil.
  if (dueCtx) {
    const newDue = (data.dueDate as Date | null) ?? null;
    const changed = (dueCtx.oldDue?.getTime() ?? null) !== (newDue?.getTime() ?? null);
    if (changed) {
      await notifyProjektyCardDueDateChanged({
        memberUserIds: dueCtx.memberIds,
        actorId: user.id,
        boardId: dueCtx.boardId,
        cardId: id,
        cardTitle: dueCtx.title,
        dueDate: newDue,
      });
    }
  }

  return NextResponse.json({ card: updated });
});

// Trvalé smazání karty. UI vlny 4 kartu jen archivuje (PATCH archived) —
// hard delete zůstává pro archiv (vlna 6, „smazat z archivu"), a proto je
// povolený jen nad už archivovanou kartou.
export const DELETE = withApiError(async (_req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  const card = await loadCardForRBAC(id);
  if (!canEditCard(user, card)) {
    throw new AppError("FORBIDDEN", "Nemůžeš smazat tuto kartu.");
  }
  const state = await prisma.card.findUnique({ where: { id }, select: { archived: true } });
  if (!state?.archived) {
    throw new AppError("VALIDATION", "Nejdřív kartu archivuj — teprve archivovanou lze smazat.");
  }

  const audited = getPrismaAudited(user.id);
  // Note a Attachment jsou polymorfní (parentType/parentId) BEZ FK na Card, takže
  // je DB kaskáda nesmaže — musíme ručně, jinak osiří (u příloh navíc BLOB → únik úložiště).
  await audited.$transaction(async (tx) => {
    await tx.note.deleteMany({ where: { parentType: "CARD", parentId: id } });
    await tx.attachment.deleteMany({ where: { parentType: "CARD", parentId: id } });
    await tx.card.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
});
