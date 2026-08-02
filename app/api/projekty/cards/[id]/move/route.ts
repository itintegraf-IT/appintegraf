import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { loadCardForRBAC } from "@/lib/projekty/board-rbac";
import { canEditCard } from "@/lib/projekty/rbac";
import { CardMoveSchema } from "@/lib/projekty/validators/card";
import { between, needsRebalance, rebalancePositions } from "@/lib/projekty/position";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id: cardId } = await params;

  const cardForRbac = await loadCardForRBAC(cardId);
  if (!canEditCard(user, cardForRbac)) {
    throw new AppError("FORBIDDEN", "Nemůžeš přesouvat tuto kartu.");
  }

  const body: unknown = await req.json();
  const parsed = CardMoveSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  const { listId: targetListId, afterCardId, beforeCardId } = parsed.data;

  // Load target list
  const targetList = await prisma.boardList.findUnique({
    where: { id: targetListId },
    select: { id: true, boardId: true, archived: true },
  });
  if (!targetList) throw new AppError("NOT_FOUND", "Cílový sloupec nenalezen.");
  if (targetList.archived) {
    throw new AppError("VALIDATION", "Cílový sloupec je archivovaný.");
  }

  // Block cross-board moves in v1
  if (targetList.boardId !== cardForRbac.boardId) {
    throw new AppError("VALIDATION", "Karta se nemůže přesunout do jiného boardu (zatím nepodporováno).");
  }

  // Resolve neighbor positions in target list
  const prev = afterCardId
    ? await prisma.card.findUnique({
        where: { id: afterCardId },
        select: { position: true, listId: true },
      })
    : null;
  const next = beforeCardId
    ? await prisma.card.findUnique({
        where: { id: beforeCardId },
        select: { position: true, listId: true },
      })
    : null;

  if (prev && prev.listId !== targetListId) {
    throw new AppError("VALIDATION", "afterCardId není v cílovém sloupci.");
  }
  if (next && next.listId !== targetListId) {
    throw new AppError("VALIDATION", "beforeCardId není v cílovém sloupci.");
  }

  const newPosition = between(prev?.position ?? null, next?.position ?? null);

  const audited = getPrismaAudited(user.id);
  await audited.card.update({
    where: { id: cardId },
    data: {
      listId: targetListId,
      boardId: targetList.boardId, // atomic denormalized invariant
      position: newPosition,
    },
  });

  // On-the-fly rebalance pokud drift v target list
  const allPositions = await prisma.card.findMany({
    where: { listId: targetListId, archived: false },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  if (needsRebalance(allPositions.map((c) => c.position))) {
    const newPositionsMap = rebalancePositions(allPositions);
    await prisma.$transaction(
      Array.from(newPositionsMap.entries()).map(([id, pos]) =>
        prisma.card.update({ where: { id }, data: { position: pos } }),
      ),
    );
  }

  return NextResponse.json({ ok: true });
});
