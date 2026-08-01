"use client";

import { Fragment, useId, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useDndContext,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Columns3 } from "lucide-react";
import {
  BoardListColumn,
  BoardListColumnDragOverlay,
  type ListData,
} from "./BoardListColumn";
import { BoardListAddInline } from "./BoardListAddInline";
import { EmptyState } from "@/components/projekty/ui/empty-state";
import { CardItemDragOverlay, type CardData } from "./CardItem";
import { DropLine } from "./DropLine";
import { useBulkSelection } from "./BulkSelectionContext";
import { useResponsiveSensors } from "@/lib/projekty/dnd-sensors";
import { useOptimisticListsMutation } from "@/hooks/projekty/useOptimisticListsMutation";

export function KanbanBoard({
  boardId,
  lists,
  setLists,
  displayedLists,
}: {
  boardId: string;
  lists: ListData[];
  setLists: React.Dispatch<React.SetStateAction<ListData[]>>;
  displayedLists: ListData[];
}) {
  const [activeCard, setActiveCard] = useState<CardData | null>(null);
  const [activeList, setActiveList] = useState<ListData | null>(null);
  const [dragIds, setDragIds] = useState<string[]>([]);
  const sensors = useResponsiveSensors();
  const dndId = useId();
  const sel = useBulkSelection();
  const mutateLists = useOptimisticListsMutation({ lists, setLists });

  function handleDragStart(event: DragStartEvent) {
    const data: { type?: string } | undefined = event.active.data.current;
    if (data?.type === "card") {
      const activeId = String(event.active.id);
      const card = lists.flatMap((l) => l.cards).find((c) => c.id === activeId);
      setActiveCard(card ?? null);
      if (sel.isSelected(activeId) && sel.count > 1) {
        setDragIds([...sel.selectedIds]);
      } else {
        setDragIds([activeId]);
      }
    } else if (data?.type === "list") {
      const list = lists.find((l) => l.id === event.active.id);
      setActiveList(list ?? null);
      setDragIds([]);
    }
  }

  function handleDragCancel() {
    setActiveCard(null);
    setActiveList(null);
    setDragIds([]);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const multi = dragIds.length > 1;
    setActiveCard(null);
    setActiveList(null);
    const { active, over } = event;

    const activeData: { type?: string; listId?: string } | undefined = active.data.current;
    const overData: { type?: string; listId?: string } | undefined = over?.data.current;

    if (activeData?.type === "card" && multi) {
      const ids = dragIds;
      setDragIds([]);
      if (!over) return;
      const targetListId =
        overData?.type === "card" ? overData.listId : String(over.id);
      if (!targetListId) return;
      // Sanity check: cílový list musí být v boardu
      if (!lists.some((l) => l.id === targetListId)) return;

      // Undo podklad: původní list per karta (pozice se neobnoví — jde na
      // konec; dokumentovaná limitace bulk move API)
      const originListById = new Map<string, string>();
      for (const l of lists) {
        for (const c of l.cards) {
          if (ids.includes(c.id)) originListById.set(c.id, l.id);
        }
      }
      const idSet = new Set(ids);
      const targetName = lists.find((l) => l.id === targetListId)?.name ?? "";

      const ok = await mutateLists({
        // Optimistic: vyjmout označené karty odevšad a připojit na konec cíle
        optimistic: (prev) => {
          const moved = prev
            .flatMap((l) => l.cards)
            .filter((c) => idSet.has(c.id))
            .map((c) => ({ ...c, listId: targetListId }));
          return prev.map((l) => {
            const kept = l.cards.filter((c) => !idSet.has(c.id));
            return l.id === targetListId ? { ...l, cards: [...kept, ...moved] } : { ...l, cards: kept };
          });
        },
        request: () =>
          fetch("/api/projekty/cards/bulk", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "move",
              cardIds: ids,
              payload: { listId: targetListId },
            }),
          }),
        errorMessage: "Hromadný přesun karet selhal",
        refreshOnSuccess: true,
        successToast: {
          message: `${ids.length} karet přesunuto do „${targetName}“`,
          undo: async () => {
            const bySource = new Map<string, string[]>();
            for (const [cid, lid] of originListById) {
              if (lid === targetListId) continue;
              bySource.set(lid, [...(bySource.get(lid) ?? []), cid]);
            }
            const results = await Promise.all(
              [...bySource.entries()].map(([lid, cids]) =>
                fetch("/api/projekty/cards/bulk", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "move",
                    cardIds: cids,
                    payload: { listId: lid },
                  }),
                }).then((r) => r.ok),
              ),
            );
            return results.every(Boolean);
          },
        },
      });
      if (ok) sel.clear();
      return;
    }

    setDragIds([]);
    if (!over) return;

    if (activeData?.type === "card") {
      await handleCardDragEnd(active, over, activeData, overData);
    } else if (activeData?.type === "list") {
      await handleListDragEnd(active, over);
    }
  }

  async function handleListDragEnd(
    active: DragEndEvent["active"],
    over: NonNullable<DragEndEvent["over"]>,
  ) {
    if (active.id === over.id) return;
    const oldIndex = lists.findIndex((l) => l.id === active.id);
    const newIndex = lists.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(lists, oldIndex, newIndex);
    const before = reordered[newIndex - 1];
    const after = reordered[newIndex + 1];
    const body: Record<string, string> = {};
    if (before) body.afterListId = before.id;
    if (after) body.beforeListId = after.id;
    if (!body.afterListId && !body.beforeListId) return;

    await mutateLists({
      optimistic: () => reordered,
      request: () =>
        fetch(`/api/projekty/lists/${active.id}/position`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      errorMessage: "Přesun listu selhal",
    });
  }

  async function handleCardDragEnd(
    active: DragEndEvent["active"],
    over: NonNullable<DragEndEvent["over"]>,
    activeData: { listId?: string },
    overData: { type?: string; listId?: string } | undefined,
  ) {
    const cardId = String(active.id);
    const sourceListId = activeData.listId;
    if (!sourceListId) return;

    const targetListId =
      overData?.type === "card" ? overData.listId : String(over.id);
    if (!targetListId) return;

    const original = lists;
    const sourceList = original.find((l) => l.id === sourceListId);
    const targetList = original.find((l) => l.id === targetListId);
    if (!sourceList || !targetList) return;

    const sourceCard = sourceList.cards.find((c) => c.id === cardId);
    if (!sourceCard) return;

    if (sourceListId === targetListId && over.id === cardId) return;

    const updatedSourceCards = sourceList.cards.filter((c) => c.id !== cardId);
    let targetCards =
      targetList.id === sourceList.id ? updatedSourceCards : [...targetList.cards];

    let insertIndex: number;
    if (overData?.type === "card") {
      insertIndex = targetCards.findIndex((c) => c.id === over.id);
      if (insertIndex === -1) insertIndex = targetCards.length;
    } else {
      insertIndex = targetCards.length;
    }

    const movedCard: CardData = { ...sourceCard, listId: targetListId };
    targetCards = [
      ...targetCards.slice(0, insertIndex),
      movedCard,
      ...targetCards.slice(insertIndex),
    ];

    const newLists = lists.map((l) => {
      if (l.id === sourceList.id && l.id === targetList.id) {
        return { ...l, cards: targetCards };
      }
      if (l.id === sourceList.id) return { ...l, cards: updatedSourceCards };
      if (l.id === targetList.id) return { ...l, cards: targetCards };
      return l;
    });

    const newTargetCards = newLists.find((l) => l.id === targetListId)?.cards ?? [];
    const newCardIndex = newTargetCards.findIndex((c) => c.id === cardId);
    const before = newTargetCards[newCardIndex - 1];
    const after = newTargetCards[newCardIndex + 1];

    const body: Record<string, string> = { listId: targetListId };
    if (before) body.afterCardId = before.id;
    if (after) body.beforeCardId = after.id;

    const crossList = sourceListId !== targetListId;
    // Undo podklad: původní sousedé ve zdrojovém sloupci
    const origIndex = sourceList.cards.findIndex((c) => c.id === cardId);
    const origBefore = sourceList.cards[origIndex - 1];
    const origAfter = sourceList.cards[origIndex + 1];

    await mutateLists({
      optimistic: () => newLists,
      request: () =>
        fetch(`/api/projekty/cards/${cardId}/move`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      errorMessage: "Přesun karty selhal",
      successToast: crossList
        ? {
            message: `Karta přesunuta do „${targetList.name}“`,
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

  function handleCardCreated(listId: string, card: CardData) {
    setLists((prev) =>
      prev.map((l) => (l.id === listId ? { ...l, cards: [...l.cards, card] } : l)),
    );
  }

  // Ordered card IDs: column-by-column (left-to-right), top-to-bottom per column.
  // Používá se pro shift-click range select v CardItem.
  const orderedCardIds = useMemo(
    () => displayedLists.flatMap((l) => l.cards.map((c) => c.id)),
    [displayedLists],
  );

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <ColumnsList
        boardId={boardId}
        lists={displayedLists}
        orderedCardIds={orderedCardIds}
        onListUpdate={(updated) =>
          setLists((prev) =>
            prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)),
          )
        }
        onListDelete={(id) => setLists((prev) => prev.filter((l) => l.id !== id))}
        onListArchive={(id, archived) => {
          if (archived) {
            setLists((prev) => prev.filter((l) => l.id !== id));
          } else {
            setLists((prev) =>
              prev.map((l) => (l.id === id ? { ...l, archived: false } : l)),
            );
          }
        }}
        onCardCreated={handleCardCreated}
        onListCreated={(list) =>
          setLists((prev) => [...prev, { ...list, cards: [] }])
        }
      />
      <DragOverlay dropAnimation={null}>
        {activeCard && dragIds.length > 1 ? (
          <div className="rounded-lg border-2 border-primary bg-card p-3 shadow-lg">
            <div className="text-sm font-medium">{activeCard.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              +{dragIds.length - 1} dalších karet
            </div>
          </div>
        ) : activeCard ? (
          <CardItemDragOverlay card={activeCard} boardId={boardId} />
        ) : activeList ? (
          <BoardListColumnDragOverlay list={activeList} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function ColumnsList({
  boardId,
  lists,
  orderedCardIds,
  onListUpdate,
  onListDelete,
  onListArchive,
  onCardCreated,
  onListCreated,
}: {
  boardId: string;
  lists: ListData[];
  orderedCardIds: string[];
  onListUpdate: (l: ListData) => void;
  onListDelete: (id: string) => void;
  onListArchive: (id: string, archived: boolean) => void;
  onCardCreated: (listId: string, card: CardData) => void;
  onListCreated: (list: Omit<ListData, "cards">) => void;
}) {
  const { active, over } = useDndContext();
  const draggingListId =
    active?.data.current?.type === "list" ? String(active.id) : null;
  const overListId =
    over?.data.current?.type === "list" ? String(over.id) : null;

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden">
      <div className="flex h-full gap-4 p-4 snap-x snap-mandatory">
        <SortableContext
          items={lists.map((l) => l.id)}
          strategy={horizontalListSortingStrategy}
        >
          {lists.map((list) => {
            const showLineBefore =
              draggingListId !== null &&
              draggingListId !== list.id &&
              overListId === list.id;
            return (
              <Fragment key={list.id}>
                {showLineBefore ? <DropLine orientation="vertical" /> : null}
                <BoardListColumn
                  list={list}
                  orderedCardIds={orderedCardIds}
                  onListUpdate={onListUpdate}
                  onListDelete={onListDelete}
                  onListArchive={onListArchive}
                  onCardCreated={onCardCreated}
                />
              </Fragment>
            );
          })}
        </SortableContext>
        {lists.length === 0 ? (
          <EmptyState
            icon={Columns3}
            title="Board nemá žádné sloupce"
            description="Přidej první sloupec a začni organizovat karty."
            className="flex-1"
          />
        ) : null}
        <BoardListAddInline boardId={boardId} onCreated={onListCreated} />
      </div>
    </div>
  );
}
