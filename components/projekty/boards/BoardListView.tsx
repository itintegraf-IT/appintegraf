"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SearchX } from "lucide-react";
import { type ListData } from "./BoardListColumn";
import { EmptyState } from "@/components/projekty/ui/empty-state";
import { deleteCardFilterParams, hasAnyCardFilter } from "@/lib/projekty/card-filters";
import { ListGroupHeader } from "./ListGroupHeader";
import { ListCardRow } from "./ListCardRow";
import { DropLine } from "./DropLine";
import { Button } from "@/components/projekty/ui/button";
import { type CardData } from "./CardItem";
import { useResponsiveSensors } from "@/lib/projekty/dnd-sensors";
import { useOptimisticListsMutation } from "@/hooks/projekty/useOptimisticListsMutation";
import { parseBoardGroup } from "@/lib/projekty/board-view";
import { buildGroups } from "@/lib/projekty/list-grouping";

export function BoardListView({
  displayedLists,
  lists,
  setLists,
  allMembers,
}: {
  displayedLists: ListData[];
  lists: ListData[];
  setLists: React.Dispatch<React.SetStateAction<ListData[]>>;
  allMembers: { id: number; name: string | null; email: string | null }[];
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [activeCard, setActiveCard] = useState<CardData | null>(null);
  const [overCardId, setOverCardId] = useState<string | null>(null);
  const sensors = useResponsiveSensors();
  const mutateLists = useOptimisticListsMutation({ lists, setLists });

  const groupBy = parseBoardGroup(searchParams);
  const groups = useMemo(
    () => buildGroups(groupBy, displayedLists, allMembers),
    [groupBy, displayedLists, allMembers],
  );
  const listById = useMemo(
    () => new Map(displayedLists.map((l) => [l.id, l])),
    [displayedLists],
  );

  const totalCards = displayedLists.reduce((acc, l) => acc + l.cards.length, 0);
  const hasActiveFilter = hasAnyCardFilter(searchParams);

  // Flat ordered list of card IDs in display order — used for shift-range selection
  const orderedCardIds = useMemo(
    () => displayedLists.flatMap((l) => l.cards.map((c) => c.id)),
    [displayedLists],
  );

  function clearFilters() {
    const sp = new URLSearchParams(searchParams.toString());
    deleteCardFilterParams(sp);
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
    setOverCardId(null);
  }

  function handleDragOver(event: DragOverEvent) {
    const over = event.over;
    setOverCardId(
      over && over.data.current?.type === "card" ? String(over.id) : null,
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    setOverCardId(null);
    const { active, over } = event;
    if (!over) return;

    const cardId = String(active.id);
    const found = findCardById(cardId);
    if (!found) return;

    // over.data.current is Record<string, any> — safe to access listId directly
    const targetListId = over.data.current?.listId as string | undefined;
    if (!targetListId) return;

    // Poziční drop: drop na kartu = vlož před ni; drop na hlavičku = na konec
    const overIsCard = over.data.current?.type === "card";
    const insertBeforeId = overIsCard ? String(over.id) : null;
    if (insertBeforeId === cardId) return;

    const sourceListId = found.sourceListId;
    const crossList = targetListId !== sourceListId;
    if (!crossList && insertBeforeId === null) return; // drop na vlastní hlavičku

    const targetName = lists.find((l) => l.id === targetListId)?.name ?? "";

    // Undo podklad: původní sousedé ve zdrojovém sloupci
    const sourceCards = lists.find((l) => l.id === sourceListId)?.cards ?? [];
    const origIndex = sourceCards.findIndex((c) => c.id === cardId);
    const origBefore = sourceCards[origIndex - 1];
    const origAfter = sourceCards[origIndex + 1];

    // Optimistic výsledek spočítat předem — z něj plynou sousedé pro API
    const movedCard: CardData = { ...found.card, listId: targetListId };
    const optimisticLists = lists.map((l) => {
      const without = l.cards.filter((c) => c.id !== cardId);
      if (l.id !== targetListId) {
        return l.id === sourceListId ? { ...l, cards: without } : l;
      }
      const base = l.id === sourceListId ? without : l.cards.filter((c) => c.id !== cardId);
      const idx = insertBeforeId
        ? Math.max(0, base.findIndex((c) => c.id === insertBeforeId))
        : base.length;
      const cards = [...base.slice(0, idx), movedCard, ...base.slice(idx)];
      return { ...l, cards };
    });
    const newTargetCards =
      optimisticLists.find((l) => l.id === targetListId)?.cards ?? [];
    const newIndex = newTargetCards.findIndex((c) => c.id === cardId);
    const before = newTargetCards[newIndex - 1];
    const after = newTargetCards[newIndex + 1];

    const body: Record<string, string> = { listId: targetListId };
    if (before) body.afterCardId = before.id;
    if (after) body.beforeCardId = after.id;

    await mutateLists({
      optimistic: () => optimisticLists,
      request: () =>
        fetch(`/api/projekty/cards/${cardId}/move`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      errorMessage: "Přesun karty selhal",
      successToast: crossList
        ? {
            message: `Karta přesunuta do „${targetName}“`,
            undo: async () => {
              const undoBody: Record<string, string> = { listId: sourceListId };
              if (origBefore) undoBody.afterCardId = origBefore.id;
              if (origAfter) undoBody.beforeCardId = origAfter.id;
              const r = await fetch(`/api/projekty/cards/${cardId}/move`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(undoBody),
              });
              return r.ok;
            },
          }
        : undefined,
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
      onDragOver={handleDragOver}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-y-auto bg-background">
        {groups.map((group) => (
          <section key={group.key} className="mb-2">
            <ListGroupHeader
              groupKey={group.key}
              label={group.label}
              dotColor={group.dotColor}
              totalCount={group.cards.length}
              completedCount={group.cards.filter((c) => c.completed).length}
              droppableListId={group.droppableListId}
            />
            <SortableContext
              items={group.cards.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {group.cards.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground/70">
                  Žádné karty v tomto sloupci.
                </p>
              ) : (
                group.cards.map((card) => (
                  <div key={card.id}>
                    {activeCard &&
                    overCardId === card.id &&
                    activeCard.id !== card.id ? (
                      <DropLine orientation="horizontal" />
                    ) : null}
                    <ListCardRow
                      card={card}
                      list={listById.get(card.listId) ?? displayedLists[0]!}
                      orderedCardIds={orderedCardIds}
                      onToggleCompleted={(c) => void toggleCompleted(c)}
                      dragDisabled={groupBy !== "list"}
                    />
                  </div>
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
