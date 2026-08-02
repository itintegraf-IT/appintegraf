import { requireSession } from "@/lib/projekty/session";
import { prisma } from "@/lib/projekty/prisma";
import { projektyUserSelect, toDisplayUser } from "@/lib/projekty/user-display";
import { BoardsGrid } from "@/components/projekty/boards/BoardsGrid";
import { BoardEmptyState } from "@/components/projekty/boards/BoardEmptyState";

export default async function BoardsPage() {
  const user = await requireSession();

  const boards = await prisma.board.findMany({
    where: {
      archived: false,
      ...(user.role === "ADMIN"
        ? {}
        : {
            OR: [
              { ownerId: user.id },
              { members: { some: { userId: user.id } } },
            ],
          }),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      background: true,
      ownerId: true,
      updatedAt: true,
      _count: { select: { lists: true } },
      members: {
        select: {
          user: { select: projektyUserSelect },
        },
        take: 4,
      },
      owner: { select: projektyUserSelect },
    },
  });

  // Card counts per board (separate query — Prisma cannot count grandchildren via _count)
  const boardIds = boards.map((b) => b.id);
  const cardCounts = boardIds.length
    ? await prisma.card.groupBy({
        by: ["boardId"],
        where: { boardId: { in: boardIds }, archived: false },
        _count: { id: true },
      })
    : [];
  const cardCountMap = Object.fromEntries(cardCounts.map((c) => [c.boardId, c._count.id]));

  const enrichedBoards = boards.map((b) => ({
    ...b,
    owner: toDisplayUser(b.owner),
    members: b.members.map((m) => ({ ...m, user: toDisplayUser(m.user) })),
    cardsCount: cardCountMap[b.id] ?? 0,
  }));

  return (
    <main className="p-4 md:p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Boards</h1>
      </header>
      {boards.length === 0 ? <BoardEmptyState /> : <BoardsGrid boards={enrichedBoards} />}
    </main>
  );
}
