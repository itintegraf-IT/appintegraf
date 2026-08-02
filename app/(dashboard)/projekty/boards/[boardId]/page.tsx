import { notFound } from "next/navigation";
import { requireSession } from "@/lib/projekty/session";
import { prisma } from "@/lib/projekty/prisma";
import { canViewBoard } from "@/lib/projekty/rbac";
import { loadBoardForRBAC } from "@/lib/projekty/board-rbac";
import { isAppError } from "@/lib/projekty/errors";
import { projektyUserSelect, toDisplayUser } from "@/lib/projekty/user-display";
import { BoardView } from "@/components/projekty/boards/BoardView";

type Params = Promise<{ boardId: string }>;

export default async function BoardPage({ params }: { params: Params }) {
  const user = await requireSession();
  const { boardId } = await params;

  const rbacBoard = await loadBoardForRBAC(boardId).catch((err) => {
    if (isAppError(err) && err.code === "NOT_FOUND") return null;
    throw err;
  });
  if (!rbacBoard) notFound();
  if (!canViewBoard(user, rbacBoard)) notFound();

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      name: true,
      description: true,
      background: true,
      ownerId: true,
      owner: { select: projektyUserSelect },
      members: {
        include: {
          user: { select: projektyUserSelect },
        },
      },
      labels: { orderBy: { name: "asc" } },
      lists: {
        where: { archived: false },
        orderBy: { position: "asc" },
        select: {
          id: true,
          boardId: true,
          name: true,
          color: true,
          position: true,
          archived: true,
          cards: {
            where: { archived: false },
            orderBy: { position: "asc" },
            include: {
              members: {
                include: {
                  user: { select: projektyUserSelect },
                },
              },
              labels: { include: { label: true } },
              _count: { select: { checklists: true } },
            },
          },
        },
      },
    },
  });
  if (!board) notFound();

  // Polymorfní counts — Note + Attachment + checklist done/total
  const cardIds = board.lists.flatMap((l) => l.cards.map((c) => c.id));
  const [noteCounts, attachmentCounts, checklistRows] = await Promise.all([
    cardIds.length > 0
      ? prisma.note.groupBy({
          by: ["parentId"],
          where: { parentType: "CARD", parentId: { in: cardIds } },
          _count: { id: true },
        })
      : Promise.resolve([] as Array<{ parentId: string; _count: { id: number } }>),
    cardIds.length > 0
      ? prisma.attachment.groupBy({
          by: ["parentId"],
          where: { parentType: "CARD", parentId: { in: cardIds } },
          _count: { id: true },
        })
      : Promise.resolve([] as Array<{ parentId: string; _count: { id: number } }>),
    cardIds.length > 0
      ? prisma.checklist.findMany({
          where: { cardId: { in: cardIds } },
          select: { cardId: true, items: { select: { done: true } } },
        })
      : Promise.resolve([] as Array<{ cardId: string; items: { done: boolean }[] }>),
  ]);
  const noteCountMap = Object.fromEntries(noteCounts.map((n) => [n.parentId, n._count.id]));
  const checklistMap = new Map<string, { done: number; total: number }>();
  for (const row of checklistRows) {
    const agg = checklistMap.get(row.cardId) ?? { done: 0, total: 0 };
    agg.total += row.items.length;
    agg.done += row.items.filter((i) => i.done).length;
    checklistMap.set(row.cardId, agg);
  }
  const attachmentCountMap = Object.fromEntries(
    attachmentCounts.map((a) => [a.parentId, a._count.id]),
  );

  const enriched = {
    ...board,
    owner: toDisplayUser(board.owner),
    members: board.members.map((m) => ({ ...m, user: toDisplayUser(m.user) })),
    lists: board.lists.map((l) => ({
      ...l,
      cards: l.cards.map((c) => ({
        ...c,
        members: c.members.map((m) => ({ ...m, user: toDisplayUser(m.user) })),
        notesCount: noteCountMap[c.id] ?? 0,
        attachmentsCount: attachmentCountMap[c.id] ?? 0,
        checklistDone: checklistMap.get(c.id)?.done ?? 0,
        checklistTotal: checklistMap.get(c.id)?.total ?? 0,
      })),
    })),
  };

  return <BoardView board={enriched} currentUserId={user.id} />;
}
