import { requireSession } from "@/lib/projekty/session";
import { prisma } from "@/lib/projekty/prisma";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { DueDateBadge } from "@/components/projekty/DueDateBadge";

// Cross-board přehled "Moje karty": karty (nearchivované), kde je přihlášený
// uživatel členem. Read-only; každý řádek deep-linkuje na detail karty.
export default async function MyCardsPage() {
  const user = await requireSession();

  const cards = (
    await prisma.card.findMany({
      where: {
        archived: false,
        members: { some: { userId: user.id } },
      },
      include: {
        list: { select: { id: true, name: true } },
        labels: { include: { label: true } },
      },
      orderBy: { updatedAt: "desc" },
    })
  ).sort((a, b) => {
    // Karty s termínem první (dle termínu vzestupně), bez termínu poslední (dle updatedAt sestupně).
    // JS řazení místo SQL ORDER BY dueDate — MySQL řadí NULL jako první, což by vyneslo
    // karty bez termínu nad ty nejnaléhavější.
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  // Board kontext (Card nemá přímou relaci na Board — druhý dotaz dle boardId).
  const boardIds = [...new Set(cards.map((c) => c.boardId))];
  const boards =
    boardIds.length > 0
      ? await prisma.board.findMany({
          where: { id: { in: boardIds } },
          select: { id: true, name: true, background: true },
        })
      : [];
  const boardMap = Object.fromEntries(boards.map((b) => [b.id, b]));

  return (
    <main className="space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Moje karty</h1>
      {cards.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed py-12 text-center text-muted-foreground">
          Žádné karty ti nejsou přiřazené.
        </div>
      ) : (
        <ul className="space-y-2">
          {cards.map((c) => {
            const board = boardMap[c.boardId];
            return (
              <li key={c.id}>
                <Link
                  href={`/projekty/boards/${c.boardId}?card=${c.id}`}
                  className="flex items-center gap-3 rounded border p-3 transition-colors hover:bg-muted/40"
                >
                  {board ? (
                    <span
                      className="size-3 shrink-0 rounded"
                      style={{ backgroundColor: board.background ?? "#475569" }}
                      title={board.name}
                    />
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`truncate text-sm ${c.completed ? "text-muted-foreground line-through" : ""}`}
                    >
                      {c.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {board?.name ?? "?"} · {c.list.name}
                    </p>
                  </div>
                  {c.labels.length > 0 ? (
                    <div className="flex shrink-0 gap-1">
                      {c.labels.slice(0, 3).map((l) => (
                        <span
                          key={l.labelId}
                          className="rounded px-1.5 py-0.5 text-[10px] text-white"
                          style={{ backgroundColor: l.label.color }}
                        >
                          {l.label.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {c.completed ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  ) : null}
                  {c.dueDate ? (
                    <DueDateBadge
                      due={c.dueDate}
                      completed={c.completed}
                      variant="withYear"
                      className="shrink-0"
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
