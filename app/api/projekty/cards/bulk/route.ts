import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { canEditCard } from "@/lib/projekty/rbac";
import { loadCardForRBAC } from "@/lib/projekty/board-rbac";
import { BulkUpdateSchema, BulkDeleteSchema } from "@/lib/projekty/validators/bulk-cards";

export const PATCH = withApiError(async (req: Request) => {
  const user = await requireSession();
  const body: unknown = await req.json();
  const parsed = BulkUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  const { cardIds, action, payload } = parsed.data;

  // Permission check per-card + same-board guard
  const cards = await Promise.all(cardIds.map((id) => loadCardForRBAC(id)));
  for (const c of cards) {
    if (!canEditCard(user, c)) {
      throw new AppError("FORBIDDEN", "Nemáš oprávnění k některé z karet.");
    }
  }
  const boardIds = new Set(cards.map((c) => c.boardId));
  if (boardIds.size !== 1) {
    throw new AppError("VALIDATION", "Bulk akce musí být v rámci jednoho boardu.");
  }
  const boardId = [...boardIds][0]!;

  // Jeden UUID pro celou bulk operaci — všechny audit entries budou grupovatelné
  const bulkOperationId = crypto.randomUUID();
  const audited = getPrismaAudited(user.id, { bulkOperationId });

  // Vše přes audited.$transaction → zápisy jsou atomické i auditované (tx = audited tx client).
  await audited.$transaction(async (tx) => {
    if (action === "move") {
      // Ověř, že cílový list patří stejnému boardu
      const targetList = await tx.boardList.findUnique({
        where: { id: payload.listId },
        select: { boardId: true },
      });
      if (!targetList || targetList.boardId !== boardId) {
        throw new AppError("VALIDATION", "Cílový sloupec není ve stejném boardu.");
      }
      // Najdi max position v target listu (nezahrnovat archivované)
      const max = await tx.card.aggregate({
        where: { listId: payload.listId, archived: false },
        _max: { position: true },
      });
      let basePosition = (max._max.position ?? 0) + 1;
      // Update v původním pořadí cardIds (zachová vzájemné pořadí)
      for (const cardId of cardIds) {
        await tx.card.update({
          where: { id: cardId },
          data: { listId: payload.listId, boardId, position: basePosition++ },
        });
      }
    } else if (action === "addLabel") {
      // Všechny labely musí patřit k tomuto boardu (jinak cross-board leak / FK 500).
      const wantedLabelIds = [...new Set(payload.labelIds)];
      const validLabels = await tx.label.findMany({
        where: { id: { in: wantedLabelIds }, boardId },
        select: { id: true },
      });
      if (validLabels.length !== wantedLabelIds.length) {
        throw new AppError("VALIDATION", "Některý štítek neexistuje nebo nepatří k tomuto boardu.");
      }
      const data = cardIds.flatMap((cardId) =>
        wantedLabelIds.map((labelId) => ({ cardId, labelId })),
      );
      await tx.cardLabel.createMany({ data, skipDuplicates: true });
    } else if (action === "addMember") {
      // Všechna userId musí být owner nebo člen boardu (jinak non-member přiřazení / FK 500).
      const wantedUserIds = [...new Set(payload.userIds)];
      const board = await tx.board.findUnique({
        where: { id: boardId },
        select: { ownerId: true, members: { select: { userId: true } } },
      });
      const allowed = new Set<number>([
        ...(board ? [board.ownerId] : []),
        ...(board?.members.map((m) => m.userId) ?? []),
      ]);
      if (wantedUserIds.some((uid) => !allowed.has(uid))) {
        throw new AppError("VALIDATION", "Některý uživatel není členem tohoto boardu.");
      }
      const data = cardIds.flatMap((cardId) =>
        wantedUserIds.map((userId) => ({ cardId, userId })),
      );
      await tx.cardMember.createMany({ data, skipDuplicates: true });
    } else if (action === "setPriority") {
      // Po jedné (ne updateMany) — audit extension zachytává jen `update`,
      // hromadná varianta by se do audit logu vůbec nezapsala.
      for (const cardId of cardIds) {
        await tx.card.update({
          where: { id: cardId },
          data: { priority: payload.priority },
        });
      }
    } else if (action === "archive") {
      // (Od)archivace — inverzní operace k bulk DELETE (soft archived flag);
      // používá ji undo toast v BulkActionBar.
      for (const cardId of cardIds) {
        await tx.card.update({
          where: { id: cardId },
          data: { archived: payload.archived },
        });
      }
    }
  });

  return NextResponse.json({ updated: cardIds.length });
});

export const DELETE = withApiError(async (req: Request) => {
  const user = await requireSession();
  const body: unknown = await req.json();
  const parsed = BulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  const cards = await Promise.all(parsed.data.cardIds.map((id) => loadCardForRBAC(id)));
  for (const c of cards) {
    if (!canEditCard(user, c)) {
      throw new AppError("FORBIDDEN", "Nemáš oprávnění k některé z karet.");
    }
  }
  const boardIds = new Set(cards.map((c) => c.boardId));
  if (boardIds.size !== 1) {
    throw new AppError("VALIDATION", "Bulk akce musí být v rámci jednoho boardu.");
  }

  // Jeden UUID pro celou bulk operaci — všechny audit entries budou grupovatelné
  const bulkOperationId = crypto.randomUUID();
  const audited = getPrismaAudited(user.id, { bulkOperationId });
  // Soft delete: archived = true (Card model nemá deletedAt field).
  // audited.$transaction (ne base prisma) — všechny updaty jsou atomické i auditované.
  await audited.$transaction(
    parsed.data.cardIds.map((id) =>
      audited.card.update({ where: { id }, data: { archived: true } }),
    ),
  );

  return NextResponse.json({ deleted: parsed.data.cardIds.length });
});
