import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { loadBoardForRBAC } from "@/lib/projekty/board-rbac";
import { canEditBoard } from "@/lib/projekty/rbac";
import { ListMoveSchema } from "@/lib/projekty/validators/board-list";
import { between, needsRebalance, rebalancePositions } from "@/lib/projekty/position";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id: listId } = await params;

  const list = await prisma.boardList.findUnique({
    where: { id: listId },
    select: { id: true, boardId: true, position: true },
  });
  if (!list) throw new AppError("NOT_FOUND", "List nenalezen.");
  const board = await loadBoardForRBAC(list.boardId);
  if (!canEditBoard(user, board)) {
    throw new AppError("FORBIDDEN", "Nemůžeš přesouvat listy.");
  }

  const body: unknown = await req.json();
  const parsed = ListMoveSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  const { afterListId, beforeListId } = parsed.data;

  const prev = afterListId
    ? await prisma.boardList.findUnique({
        where: { id: afterListId },
        select: { position: true, boardId: true },
      })
    : null;
  const next = beforeListId
    ? await prisma.boardList.findUnique({
        where: { id: beforeListId },
        select: { position: true, boardId: true },
      })
    : null;

  if (prev && prev.boardId !== list.boardId) {
    throw new AppError("VALIDATION", "afterListId není z tohoto boardu.");
  }
  if (next && next.boardId !== list.boardId) {
    throw new AppError("VALIDATION", "beforeListId není z tohoto boardu.");
  }

  const newPosition = between(prev?.position ?? null, next?.position ?? null);

  const audited = getPrismaAudited(user.id);
  await audited.boardList.update({ where: { id: listId }, data: { position: newPosition } });

  // On-the-fly rebalance pokud je drift
  const allPositions = await prisma.boardList.findMany({
    where: { boardId: list.boardId, archived: false },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  if (needsRebalance(allPositions.map((l) => l.position))) {
    const newPositionsMap = rebalancePositions(allPositions);
    await prisma.$transaction(
      Array.from(newPositionsMap.entries()).map(([id, pos]) =>
        prisma.boardList.update({ where: { id }, data: { position: pos } }),
      ),
    );
  }

  return NextResponse.json({ ok: true });
});
