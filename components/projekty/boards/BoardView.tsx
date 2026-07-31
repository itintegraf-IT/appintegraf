"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { type ListData } from "./BoardListColumn";
import { CardDetailModal } from "./CardDetailModal";
import { BoardCardFilterBar } from "./BoardCardFilterBar";
import { KanbanBoard } from "./KanbanBoard";
import { matchesFilters, parseCardFilters } from "@/lib/projekty/card-filters";
import { BoardViewTabs } from "./BoardViewTabs";
import { parseBoardView } from "@/lib/projekty/board-view";
import { BoardListView } from "./BoardListView";
import { BoardCalendarView } from "./BoardCalendarView";
import { BulkSelectionProvider, useBulkSelection } from "./BulkSelectionContext";
import { BulkActionBar } from "./BulkActionBar";

type UserLite = { id: number; email: string | null; name: string | null; image: string | null };
type BoardLabel = { id: string; name: string; color: string };

type BoardData = {
  id: string;
  name: string;
  description: string | null;
  background: string | null;
  ownerId: number;
  owner: UserLite;
  members: { userId: number; user: UserLite }[];
  labels: BoardLabel[];
  lists: ListData[];
};

type BoardViewInnerProps = {
  board: BoardData;
  currentUserId: number;
  lists: ListData[];
  setLists: React.Dispatch<React.SetStateAction<ListData[]>>;
};

/** Vnitřní komponenta — uvnitř BulkSelectionProvider scope, může volat useBulkSelection */
function BoardViewInner({ board, currentUserId, lists, setLists }: BoardViewInnerProps) {
  const sel = useBulkSelection();

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const cardIdParam = searchParams.get("card");

  // Mobile first-visit toast: pokud jsme na touch device + kanban view, ukaž
  // jednou tip že List view může být pohodlnější. Tlačítko ve toastu přepne.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) return;
    const view = parseBoardView(searchParams);
    if (view !== "kanban") return;
    const seen = localStorage.getItem("mobile-kanban-tip-seen");
    if (seen === "1") return;

    toast.info("Tip: na mobilu může být List view přehlednější.", {
      duration: 8_000,
      action: {
        label: "Přepnout",
        onClick: () => {
          const sp = new URLSearchParams(searchParams.toString());
          sp.set("view", "list");
          router.replace(`${pathname}?${sp.toString()}`);
        },
      },
    });
    localStorage.setItem("mobile-kanban-tip-seen", "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filters = parseCardFilters(searchParams);
  const allMembers: UserLite[] = [
    board.owner,
    ...board.members.map((m) => m.user).filter((u) => u.id !== board.owner.id),
  ];
  const displayedLists = lists.map((l) => ({
    ...l,
    cards: l.cards.filter((c) => matchesFilters(c, filters)),
  }));

  function closeCardModal() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("card");
    router.replace(`${pathname}${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  /** Klik na prázdnou oblast boardu (mimo karty/toolbar/dialogy/popovery/buttony) clearne selection */
  function handleBoardClick(e: React.MouseEvent) {
    if (sel.count === 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("[data-bulk-card]") ||
      target.closest("[role='toolbar']") ||
      target.closest("[role='dialog']") ||
      target.closest("[data-radix-popper-content-wrapper]") ||
      target.closest("button") ||
      target.closest("a")
    ) {
      return;
    }
    sel.clear();
  }

  return (
    <>
      <div
        className="-m-4 flex h-[calc(100dvh-3rem)] flex-col bg-background md:-m-6"
        onClick={handleBoardClick}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: board.background ?? "#64748b" }}
              aria-hidden
            />
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
              {board.name}
            </h1>
          </div>
          <Link
            href={`/projekty/boards/${board.id}/settings`}
            className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Settings className="size-4" />
            <span className="hidden sm:inline">Nastavení</span>
          </Link>
        </header>

        <BoardViewTabs />

        <BoardCardFilterBar members={allMembers} labels={board.labels} />

        {(() => {
          const view = parseBoardView(searchParams);
          switch (view) {
            case "list":
              return (
                <BoardListView
                  displayedLists={displayedLists}
                  lists={lists}
                  setLists={setLists}
                />
              );
            case "calendar":
              return (
                <BoardCalendarView
                  displayedLists={displayedLists}
                  lists={lists}
                  setLists={setLists}
                />
              );
            case "kanban":
            default:
              return (
                <KanbanBoard
                  boardId={board.id}
                  lists={lists}
                  setLists={setLists}
                  displayedLists={displayedLists}
                />
              );
          }
        })()}

        <CardDetailModal
          cardId={cardIdParam}
          currentUserId={currentUserId}
          open={Boolean(cardIdParam)}
          onOpenChange={(o) => {
            if (!o) closeCardModal();
          }}
        />
      </div>
      <BulkActionBar
        lists={lists.map((l) => ({ id: l.id, name: l.name }))}
        labels={board.labels}
        members={allMembers}
        onAction={() => router.refresh()}
      />
    </>
  );
}

export function BoardView({
  board,
  currentUserId,
}: {
  board: BoardData;
  currentUserId: number;
}) {
  const [lists, setLists] = useState<ListData[]>(board.lists);

  // Sync local lists state s prop board.lists po router.refresh().
  // useState(board.lists) běží jen jednou; bez tohoto useEffect by lists
  // zůstaly stale i po RSC re-fetch (bulk move/label/member/delete by
  // vyžadovaly hard reload). Pro lokální mutace (drag&drop) tohle nezasahuje
  // — pokud API uspělo, server state je shodný s local; pokud ne, sync
  // s server state je správné chování.
  useEffect(() => {
    setLists(board.lists);
  }, [board.lists]);

  return (
    <BulkSelectionProvider>
      <BoardViewInner
        board={board}
        currentUserId={currentUserId}
        lists={lists}
        setLists={setLists}
      />
    </BulkSelectionProvider>
  );
}
