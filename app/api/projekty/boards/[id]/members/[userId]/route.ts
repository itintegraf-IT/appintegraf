import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { loadBoardForRBAC } from "@/lib/projekty/board-rbac";
import { canEditBoard } from "@/lib/projekty/rbac";
import { BoardMemberUpdateSchema } from "@/lib/projekty/validators/board-member";

type Params = { params: Promise<{ id: string; userId: string }> };

export const PATCH = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id: boardId, userId: userIdRaw } = await params;
  const userId = parseInt(userIdRaw, 10);
  if (!Number.isFinite(userId)) throw new AppError("VALIDATION", "Neplatné userId.");

  const board = await loadBoardForRBAC(boardId);
  if (!canEditBoard(user, board)) {
    throw new AppError("FORBIDDEN", "Nemůžeš měnit členy tohoto boardu.");
  }

  if (userId === board.ownerId) {
    throw new AppError("VALIDATION", "Role ownera nelze změnit přes tento endpoint.");
  }

  const body: unknown = await req.json();
  const parsed = BoardMemberUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  const existing = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
    select: { userId: true },
  });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Člen boardu nenalezen.");
  }

  const audited = getPrismaAudited(user.id);
  const member = await audited.boardMember.update({
    where: { boardId_userId: { boardId, userId } },
    data: { role: parsed.data.role },
  });

  return NextResponse.json({ member });
});

export const DELETE = withApiError(async (_req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id: boardId, userId: userIdRaw } = await params;
  const userId = parseInt(userIdRaw, 10);
  if (!Number.isFinite(userId)) throw new AppError("VALIDATION", "Neplatné userId.");

  const board = await loadBoardForRBAC(boardId);
  if (!canEditBoard(user, board)) {
    throw new AppError("FORBIDDEN", "Nemůžeš odstraňovat členy z tohoto boardu.");
  }

  if (userId === board.ownerId) {
    throw new AppError("VALIDATION", "Owner nelze odstranit. Změň ownership přes admin nebo smaž board.");
  }

  const existing = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
    select: { userId: true },
  });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Člen boardu nenalezen.");
  }

  const audited = getPrismaAudited(user.id);
  await audited.boardMember.delete({
    where: { boardId_userId: { boardId, userId } },
  });

  return NextResponse.json({ ok: true });
});
