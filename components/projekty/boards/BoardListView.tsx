"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SearchX } from "lucide-react";
import { type ListData } from "./BoardListColumn";
import { EmptyState } from "@/components/projekty/ui/empty-state";
import { ListGroupHeader } from "./ListGroupHeader";
import { ListCardRow } from "./ListCardRow";
import { Button } from "@/components/projekty/ui/button";
import { type CardData } from "./CardItem";
import { useResponsiveSensors } from "@/lib/projekty/dnd-sensors";
import { useOptimisticListsMutation } from "@/hooks/projekty/useOptimisticListsMutation";

export function BoardListView({
  displayedLists,
  lists,
  setLists,
}: {
  displayedLists: ListData[];
  lists: ListData[];
  setLists: React.Dispatch<React.SetStateAction<ListData[]>>;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [activeCard, setActiveCard] = useState<CardData | null>(null);
  const sensors = useResponsiveSensors();
  const mutateLists = useOptimisticListsMutation({ lists, setLists });

  const totalCards = displayedLists.reduce((acc, l) => acc + l.cards.length, 0);
  const hasActiveFilter =
    !!searchParams.get("q") ||
    !!searchParams.get("members") ||
    !!searchParams.get("labels") ||
    !!searchParams.get("due") ||
    !!searchParams.get("completed");

  // Flat ordered list of card IDs in display order — used for shift-range selection
  const orderedCardIds = useMemo(
    () => displayedLists.flatMap((l) => l.cards.map((c) => c.id)),
    [displayedLists],
  );

  function clearFilters() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("q");
    sp.delete("members");
    sp.delete("labels");
    sp.delete("due");
    sp.delete("completed");
    router.replace(`${pathname}${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  function findCardById(id: string): { card: CardData; sourceListId: string } | null {
    for (const l of lists) {
      const c = l.cards.find((c) => c.id === id);
      if (c) return { card: c, sourceListId: l.id };
    }
    return null;
  }

  function handleDragStart(event: DragStartEvent) {
    const found = findCardById(String(event.active.id));
    setActiveCard(found?.card ?? null);
  }

  function handleDragCancel() {
    setActiveCard(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const cardId = String(active.id);
    const found = findCardById(cardId);
    if (!found) return;

    // over.data.current is Record<string, any> — safe to access listId directly
    const targetListId = over.data.current?.listId as string | undefined;
    if (!targetListId) return;
    if (targetListId === found.sourceListId) return; // no-op

    const targetName = lists.find((l) => l.id === targetListId)?.name ?? "";
    const sourceListId = found.sourceListId;

    await mutateLists({
      optimistic: (prev) =>
        prev.map((l) => {
          if (l.id === sourceListId) {
            return { ...l, cards: l.cards.filter((c) => c.id !== cardId) };
          }
          if (l.id === targetListId) {
            const movedCard: CardData = { ...found.card, listId: targetListId };
            return { ...l, cards: [...l.cards, movedCard] };
          }
          return l;
        }),
      request: () =>
        fetch(`/api/projekty/cards/${cardId}/move`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ listId: targetListId }),
        }),
      errorMessage: "Přesun karty selhal",
      successToast: {
        message: `Karta přesunuta do „${targetName}“`,
        undo: async () => {
          const r = await fetch(`/api/projekty/cards/${cardId}/move`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ listId: sourceListId }),
          });
          return r.ok;
        },
      },
    });
  }

  async function toggleCompleted(card: CardData) {
    const next = !card.completed;
    await mutateLists({
      optimistic: (prev) =>
        prev.map((l) => ({
          ...l,
          cards: l.cards.map((c) => (c.id === card.id ? { ...c, completed: next } : c)),
        })),
      request: () =>
        fetch(`/api/projekty/cards/${card.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ completed: next }),
        }),
      errorMessage: "Změna stavu selhala",
      refreshOnSuccess: true,
      successToast: next
        ? {
            message: "Karta označena jako hotová",
            undo: async () => {
              const r = await fetch(`/api/projekty/cards/${card.id}`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ completed: false }),
              });
              return r.ok;
            },
          }
        : undefined,
    });
  }

  // Empty state ukazujeme jen když je aktivní filter — bez filtru má smysl
  // ukázat strukturu boardu (sloupce s prázdnými hláškami), i když v něm zatím
  // nejsou žádné karty.
  if (totalCards === 0 && hasActiveFilter) {
    return (
      <EmptyState
        icon={SearchX}
        title="Žádné karty neodpovídají filtru"
        action={
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Vymazat filtry
          </Button>
        }
        className="m-4 flex-1"
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-y-auto bg-background">
        {displayedLists.map((list) => (
          <section key={list.id} className="mb-2">
            <ListGroupHeader list={list} />
            <SortableContext
              items={list.cards.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {list.cards.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground/70">
                  Žádné karty v tomto sloupci.
                </p>
              ) : (
                list.cards.map((card) => (
                  <ListCardRow
                    key={card.id}
                    card={card}
                    list={list}
                    orderedCardIds={orderedCardIds}
                    onToggleCompleted={(c) => void toggleCompleted(c)}
                  />
                ))
              )}
            </SortableContext>
          </section>
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeCard ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-2 shadow-2xl">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 tabular-nums">
              {activeCard.number}
            </span>
            <span className="text-sm font-medium">{activeCard.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
