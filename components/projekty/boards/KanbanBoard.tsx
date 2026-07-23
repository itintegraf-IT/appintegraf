"use client";

import { Fragment, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useDndContext,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import {
  BoardListColumn,
  BoardListColumnDragOverlay,
  type ListData,
} from "./BoardListColumn";
import { BoardListAddInline } from "./BoardListAddInline";
import { CardItemDragOverlay, type CardData } from "./CardItem";
import { DropLine } from "./DropLine";
import { useBulkSelection } from "./BulkSelectionContext";
import { useResponsiveSensors } from "@/lib/projekty/dnd-sensors";

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
  const router = useRouter();

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
      try {
        const res = await fetch("/api/projekty/cards/bulk", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "move",
            cardIds: ids,
            payload: { listId: targetListId },
          }),
        });
        if (!res.ok) {
          toast.error("Hromadný přesun karet selhal.");
          return;
        }
        sel.clear();
        router.refresh();
      } catch {
        toast.error("Hromadný přesun karet selhal (chyba sítě).");
      }
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

    const original = lists;
    const reordered = arrayMove(lists, oldIndex, newIndex);
    setLists(reordered);

    const before = reordered[newIndex - 1];
    const after = reordered[newIndex + 1];
    const body: Record<string, string> = {};
    if (before) body.afterListId = before.id;
    if (after) body.beforeListId = after.id;
    if (!body.afterListId && !body.beforeListId) return;

    try {
      const res = await fetch(`/api/projekty/lists/${active.id}/position`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setLists(original);
        toast.error("Přesun listu selhal.");
      }
    } catch {
      setLists(original);
      toast.error("Přesun listu selhal (chyba sítě).");
    }
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
    setLists(newLists);

    const newTargetCards = newLists.find((l) => l.id === targetListId)?.cards ?? [];
    const newCardIndex = newTargetCards.findIndex((c) => c.id === cardId);
    const before = newTargetCards[newCardIndex - 1];
    const after = newTargetCards[newCardIndex + 1];

    const body: Record<string, string> = { listId: targetListId };
    if (before) body.afterCardId = before.id;
    if (after) body.beforeCardId = after.id;

    try {
      const res = await fetch(`/api/projekty/cards/${cardId}/move`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setLists(original);
        toast.error("Přesun karty selhal.");
      }
    } catch {
      setLists(original);
      toast.error("Přesun karty selhal (chyba sítě).");
    }
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
        <BoardListAddInline boardId={boardId} onCreated={onListCreated} />
      </div>
    </div>
  );
}
