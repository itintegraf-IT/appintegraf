import { requireSession } from "@/lib/projekty/session";
import { prisma } from "@/lib/projekty/prisma";
import { PersonalTodoView } from "@/components/projekty/todos/PersonalTodoView";

const STATUS_RANK: Record<string, number> = { NOT_STARTED: 0, IN_PROGRESS: 1, DONE: 2 };

export default async function TodoPage() {
  const user = await requireSession();

  const [active, completed, archived, boards] = await Promise.all([
    prisma.personalTodo.findMany({
      where: { ownerId: user.id, archivedAt: null, status: { not: "DONE" } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.personalTodo.findMany({
      where: { ownerId: user.id, archivedAt: null, status: "DONE" },
      orderBy: [{ completedAt: "desc" }],
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

  // Aktivní úkoly seřadit v JS (MySQL neumí spolehlivě NULLS LAST):
  // status (NOT_STARTED < IN_PROGRESS), pak termín (bez termínu poslední), pak nejnovější.
  active.sort((a, b) => {
    const sr = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    if (sr !== 0) return sr;
    if (a.dueDate && b.dueDate) {
      const d = a.dueDate.getTime() - b.dueDate.getTime();
      if (d !== 0) return d;
    } else if (a.dueDate) return -1;
    else if (b.dueDate) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <PersonalTodoView
      initialActive={active}
      initialCompleted={completed}
      initialArchived={archived}
      boards={boards}
    />
  );
}
