import { prisma } from "@/lib/projekty/prisma";
import { AppError } from "@/lib/projekty/errors";
import type { BoardForRBAC, CardForRBAC } from "@/lib/projekty/rbac";
import { projektyUserSelect, toDisplayUser } from "@/lib/projekty/user-display";

/**
 * Load board s minimálními poli + members pro RBAC kontrolu.
 * Throws NOT_FOUND pokud board neexistuje.
 *
 * Vždy volej tohle před canEditBoard / canViewBoard aby RBAC měl
 * members[] (jinak silent degrade na owner-only access).
 */
export async function loadBoardForRBAC(boardId: string): Promise<BoardForRBAC> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      ownerId: true,
      members: { select: { userId: true, role: true } },
    },
  });
  if (!board) throw new AppError("NOT_FOUND", "Board nenalezen.");
  return board;
}

/**
 * Load card + jeho board members pro card-level RBAC.
 * Throws NOT_FOUND pokud karta neexistuje.
 */
export async function loadCardForRBAC(cardId: string): Promise<CardForRBAC> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: {
      id: true,
      boardId: true,
      list: {
        select: {
          board: {
            select: {
              id: true,
              ownerId: true,
              members: { select: { userId: true, role: true } },
            },
          },
        },
      },
    },
  });
  if (!card) throw new AppError("NOT_FOUND", "Karta nenalezena.");
  return {
    id: card.id,
    boardId: card.boardId,
    board: card.list.board,
  };
}

/**
 * Load card with all detail relations needed by CardDetailContent (sdílené
 * tělo detailu — Sheet panel i plná stránka karty).
 * Includes members (with user info), labels (with label info), and
 * board context (members + available labels for pickers).
 *
 * Throws AppError("NOT_FOUND") if card missing.
 */
export async function loadCardForFullDetail(cardId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      list: {
        select: {
          id: true,
          name: true,
          board: {
            select: {
              id: true,
              ownerId: true,
              members: {
                include: {
                  user: { select: projektyUserSelect },
                },
              },
              labels: { orderBy: { name: "asc" } },
            },
          },
        },
      },
      members: {
        include: { user: { select: projektyUserSelect } },
      },
      labels: { include: { label: true } },
      checklists: {
        orderBy: { position: "asc" },
        include: { items: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!card) throw new AppError("NOT_FOUND", "Karta nenalezena.");

  // Uživatele přemapuj na tvar { name, image } očekávaný UI komponentami.
  return {
    ...card,
    members: card.members.map((m) => ({ ...m, user: toDisplayUser(m.user) })),
    list: {
      ...card.list,
      board: {
        ...card.list.board,
        members: card.list.board.members.map((m) => ({ ...m, user: toDisplayUser(m.user) })),
      },
    },
  };
}
