import { requireSession } from "@/lib/projekty/session";
import { prisma } from "@/lib/projekty/prisma";
import { MyWorkView, type MyWorkCard } from "@/components/projekty/mywork/MyWorkView";

/**
 * „Moje práce" — sloučení dřívějších stránek /projekty/my-cards (karty z nástěnek)
 * a /projekty/todo (osobní To-Do) do jednoho seznamu. Obě staré routy sem
 * přesměrovávají. Řazení a sekce řeší lib/projekty/my-work.ts.
 */
export default async function MyWorkPage() {
  const user = await requireSession();

  const [cardMemberships, activeTodos, doneTodos, archived, boards] = await Promise.all([
    // assignedAt je na vazbě člen–karta, ne na kartě → jdeme přes CardMember.
    prisma.cardMember.findMany({
      where: { userId: user.id, card: { archived: false } },
      select: {
        assignedAt: true,
        card: {
          select: {
            id: true,
            title: true,
            boardId: true,
            dueDate: true,
            completed: true,
            priority: true,
            list: { select: { name: true } },
          },
        },
      },
    }),
    // Nedokončené bez limitu (jsou to živé úkoly), hotové jen posledních 50 —
    // jinak by se do klienta serializovala celá historie včetně Tiptap popisů.
    prisma.personalTodo.findMany({
      where: { ownerId: user.id, archivedAt: null, status: { not: "DONE" } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.personalTodo.findMany({
      where: { ownerId: user.id, archivedAt: null, status: "DONE" },
      orderBy: { completedAt: "desc" },
      take: 50,
    }),
    prisma.personalTodo.findMany({
      where: { ownerId: user.id, archivedAt: { not: null } },
      include: {
        promotedToCard: {
          select: {
            id: true,
            number: true,
            title: true,
            list: { select: { board: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: { archivedAt: "desc" },
      take: 50,
    }),
    prisma.board.findMany({
      where: {
        archived: false,
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id, role: { in: ["ADMIN", "MEMBER"] } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        lists: {
          where: { archived: false },
          select: { id: true, name: true, position: true },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // Název nástěnky pro kontext řádku — Card nemá přímou relaci na Board.
  const boardIds = [...new Set(cardMemberships.map((m) => m.card.boardId))];
  const boardNames = new Map(
    boardIds.length > 0
      ? (
          await prisma.board.findMany({
            where: { id: { in: boardIds } },
            select: { id: true, name: true },
          })
        ).map((b) => [b.id, b.name] as const)
      : [],
  );

  const cards: MyWorkCard[] = cardMemberships.map((m) => ({
    id: m.card.id,
    title: m.card.title,
    boardId: m.card.boardId,
    boardName: boardNames.get(m.card.boardId) ?? "Nástěnka",
    listName: m.card.list.name,
    dueDate: m.card.dueDate,
    completed: m.card.completed,
    priority: m.card.priority,
    assignedAt: m.assignedAt,
  }));

  return (
    <MyWorkView
      cards={cards}
      todos={[...activeTodos, ...doneTodos]}
      archived={archived}
      boards={boards}
    />
  );
}
