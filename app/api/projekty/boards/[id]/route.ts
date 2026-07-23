import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { prisma } from "@/lib/projekty/prisma";
import { AppError } from "@/lib/projekty/errors";
import { BoardUpdateSchema } from "@/lib/projekty/validators/board";
import { loadBoardForRBAC } from "@/lib/projekty/board-rbac";
import { canViewBoard, canEditBoard, canDeleteBoard } from "@/lib/projekty/rbac";
import { projektyUserSelect, toDisplayUser } from "@/lib/projekty/user-display";

type Params = { params: Promise<{ id: string }> };

// GET /api/boards/[id] — detail s lists + members + labels
export const GET = withApiError(async (_req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  const boardForRbac = await loadBoardForRBAC(id);
  if (!canViewBoard(user, boardForRbac)) {
    throw new AppError("FORBIDDEN", "Nemáš přístup k tomuto boardu.");
  }

  const raw = await prisma.board.findUnique({
    where: { id },
    include: {
      lists: { where: { archived: false }, orderBy: { position: "asc" } },
      members: {
        include: {
          user: { select: projektyUserSelect },
        },
      },
      labels: { orderBy: { name: "asc" } },
      owner: { select: projektyUserSelect },
    },
  });

  const board = raw
    ? {
        ...raw,
        owner: toDisplayUser(raw.owner),
        members: raw.members.map((m) => ({ ...m, user: toDisplayUser(m.user) })),
      }
    : null;

  return NextResponse.json({ board });
});

// PATCH /api/boards/[id]
export const PATCH = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  const board = await loadBoardForRBAC(id);
  if (!canEditBoard(user, board)) {
    throw new AppError("FORBIDDEN", "Nemůžeš editovat tento board.");
  }

  const body: unknown = await req.json();
  const parsed = BoardUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  const audited = getPrismaAudited(user.id);
  const updated = await audited.board.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ board: updated });
});

// DELETE /api/boards/[id]
export const DELETE = withApiError(async (_req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  const board = await loadBoardForRBAC(id);
  if (!canDeleteBoard(user, board)) {
    throw new AppError("FORBIDDEN", "Smazat board může jen owner nebo workspace ADMIN.");
  }

  const audited = getPrismaAudited(user.id);
  // Kaskáda board → lists → cards jde přes FK, ale polymorfní Note/Attachment karet
  // (bez FK na Card) musíme uklidit ručně, jinak osiří (u příloh BLOB → únik úložiště).
  await audited.$transaction(async (tx) => {
    const cards = await tx.card.findMany({ where: { boardId: id }, select: { id: true } });
    const cardIds = cards.map((c) => c.id);
    if (cardIds.length > 0) {
      await tx.note.deleteMany({ where: { parentType: "CARD", parentId: { in: cardIds } } });
      await tx.attachment.deleteMany({ where: { parentType: "CARD", parentId: { in: cardIds } } });
    }
    await tx.board.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
});
