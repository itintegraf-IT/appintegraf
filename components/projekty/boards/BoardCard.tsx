import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
import { LayoutGrid, ListTodo } from "lucide-react";
import { UserAvatar } from "@/components/projekty/UserAvatar";

type UserLite = { id: number; email: string | null; name: string | null; image: string | null };

export type BoardCardData = {
  id: string;
  name: string;
  description: string | null;
  background: string | null;
  updatedAt: Date | string;
  _count: { lists: number };
  cardsCount: number;
  members: { user: UserLite }[];
  owner: UserLite;
};

export function BoardCard({ board }: { board: BoardCardData }) {
  const accent = board.background ?? "#475569";

  // Owner + members deduped, max 4 avatars
  const peopleMap = new Map<number, UserLite>();
  peopleMap.set(board.owner.id, board.owner);
  for (const m of board.members) {
    if (!peopleMap.has(m.user.id)) peopleMap.set(m.user.id, m.user);
  }
  const people = Array.from(peopleMap.values()).slice(0, 4);
  const totalPeople = peopleMap.size;

  return (
    <Link
      href={`/projekty/boards/${board.id}`}
      className="group relative flex flex-col gap-3 rounded-lg border bg-card p-4 transition-all hover:border-foreground/30 hover:shadow-md"
      style={{ borderLeftWidth: "3px", borderLeftColor: accent }}
    >
      <div className="flex-1">
        <h3 className="font-semibold tracking-tight text-foreground group-hover:underline">
          {board.name}
        </h3>
        {board.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {board.description}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <LayoutGrid className="size-3" />
            {board._count.lists}
          </span>
          <span className="flex items-center gap-1">
            <ListTodo className="size-3" />
            {board.cardsCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {people.length > 0 ? (
            <div className="flex -space-x-1.5">
              {people.map((u) => (
                <UserAvatar
                  key={u.id}
                  user={u}
                  className="size-5 ring-2 ring-card"
                />
              ))}
              {totalPeople > people.length ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[9px] ring-2 ring-card">
                  +{totalPeople - people.length}
                </span>
              ) : null}
            </div>
          ) : null}
          <span className="hidden sm:inline">
            {formatDistanceToNow(new Date(board.updatedAt), {
              addSuffix: true,
              locale: cs,
            })}
          </span>
        </div>
      </div>
    </Link>
  );
}
