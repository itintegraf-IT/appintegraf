import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { loadBoardForRBAC } from "@/lib/projekty/board-rbac";
import { canEditBoard } from "@/lib/projekty/rbac";
import { ListUpdateSchema } from "@/lib/projekty/validators/board-list";

type Params = { params: Promise<{ id: string }> };

async function loadListWithBoardRBAC(listId: string) {
  const list = await prisma.boardList.findUnique({
    where: { id: listId },
    select: { id: true, boardId: true, name: true, position: true, archived: true },
  });
  if (!list) throw new AppError("NOT_FOUND", "List nenalezen.");
  const board = await loadBoardForRBAC(list.boardId);
  return { list, board };
}

export const PATCH = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  const { list, board } = await loadListWithBoardRBAC(id);
  if (!canEditBoard(user, board)) {
    throw new AppError("FORBIDDEN", "Nemůžeš editovat tento list.");
  }

  const body: unknown = await req.json();
  const parsed = ListUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  const audited = getPrismaAudited(user.id);
  const updated = await audited.boardList.update({ where: { id: list.id }, data: parsed.data });

  return NextResponse.json({ list: updated });
});

export const DELETE = withApiError(async (_req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  const { list, board } = await loadListWithBoardRBAC(id);
  if (!canEditBoard(user, board)) {
    throw new AppError("FORBIDDEN", "Nemůžeš mazat tento list.");
  }

  const audited = getPrismaAudited(user.id);
  // Smazání listu kaskádově maže karty (FK), ale jejich polymorfní Note/Attachment
  // (bez FK na Card) musíme uklidit ručně, jinak osiří (u příloh BLOB → únik úložiště).
  await audited.$transaction(async (tx) => {
    const cards = await tx.card.findMany({ where: { listId: list.id }, select: { id: true } });
    const cardIds = cards.map((c) => c.id);
    if (cardIds.length > 0) {
      await tx.note.deleteMany({ where: { parentType: "CARD", parentId: { in: cardIds } } });
      await tx.attachment.deleteMany({ where: { parentType: "CARD", parentId: { in: cardIds } } });
    }
    await tx.boardList.delete({ where: { id: list.id } });
  });

  return NextResponse.json({ ok: true });
});
