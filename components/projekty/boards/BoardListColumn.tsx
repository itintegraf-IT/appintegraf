"use client";

import { Fragment, useState } from "react";
import { Plus } from "lucide-react";
import { useDndContext } from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { findListColor } from "@/lib/projekty/list-colors";
import { BoardListMenu } from "./BoardListMenu";
import { CardItem, type CardData } from "./CardItem";
import { CardQuickAdd } from "./CardQuickAdd";
import { DropLine } from "./DropLine";

export type ListData = {
  id: string;
  boardId: string;
  name: string;
  color: string | null;
  position: number;
  archived: boolean;
  cards: CardData[];
};

export function BoardListColumn({
  list,
  orderedCardIds,
  onListUpdate,
  onListDelete,
  onListArchive,
  onCardCreated,
}: {
  list: ListData;
  orderedCardIds: string[];
  onListUpdate: (l: ListData) => void;
  onListDelete: (id: string) => void;
  onListArchive?: (id: string, archived: boolean) => void;
  onCardCreated?: (listId: string, card: CardData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: { type: "list" },
  });

  const colorPreset = findListColor(list.color);
  const totalCount = list.cards.length;
  const completedCount = list.cards.filter((c) => c.completed).length;

  const { active, over } = useDndContext();
  const draggingCardId =
    active?.data.current?.type === "card" ? String(active.id) : null;
  const overCardId =
    over?.data.current?.type === "card" ? String(over.id) : null;
  const overListIdForCard =
    over?.data.current?.type === "card"
      ? String(over.data.current.listId ?? "")
      : over?.data.current?.type === "list"
        ? String(over.id)
        : null;
  const isDraggingCardOverThisList =
    draggingCardId !== null && overListIdForCard === list.id;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Notion-style: originál sloupce zůstává jako "fantom" na své pozici (0.5);
    // ghost u kursoru je primární focus (DragOverlay).
    opacity: isDragging ? 0.5 : 1,
  };

  async function handleRename() {
    if (name.trim() === list.name || !name.trim()) {
      setName(list.name);
      setEditing(false);
      return;
    }
    const res = await fetch(`/api/projekty/lists/${list.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      const { list: updated } = (await res.json()) as { list: Omit<ListData, "cards"> };
      onListUpdate({ ...list, ...updated, cards: list.cards });
    } else {
      setName(list.name);
    }
    setEditing(false);
  }

  // Sloupec drag handle = celý header (kromě edit inputu a ⋯ menu — ty mají
  // onPointerDown stopPropagation níže). Karta drag je řešena uvnitř CardItem.
  return (
    <div
      ref={setNodeRef}
      style={
        {
          ...style,
          backgroundColor: colorPreset.bgTint,
          "--list-pill-bg": colorPreset.pillBg,
          "--list-cta-text": colorPreset.ctaText,
        } as React.CSSProperties
      }
      className="group/list flex h-full w-[260px] shrink-0 snap-start flex-col rounded-lg p-2"
    >
      <div
        aria-label={`Přesunout sloupec ${list.name}`}
        {...attributes}
        {...listeners}
        className="mb-2 flex h-11 cursor-grab touch-none items-center gap-2 px-1 active:cursor-grabbing"
      >
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: colorPreset.dot }}
          aria-hidden
        />
        {editing ? (
          <input
            className="min-w-0 flex-1 rounded bg-card px-2 py-0.5 text-sm font-semibold tracking-tight text-foreground outline-none ring-1 ring-border focus:ring-ring"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void handleRename()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRename();
              if (e.key === "Escape") {
                setName(list.name);
                setEditing(false);
              }
            }}
            autoFocus
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <h3
            className="cursor-pointer truncate text-sm font-semibold tracking-tight text-foreground"
            onClick={() => setEditing(true)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {list.name}
          </h3>
        )}
        <span className="ml-1 inline-flex items-center rounded-full bg-[var(--list-pill-bg)] px-1.5 py-0.5 text-xs tabular-nums text-[var(--list-cta-text)]">
          {totalCount}
        </span>
        <div
          className="ml-auto opacity-0 transition-opacity group-hover/list:opacity-100 focus-within:opacity-100"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <BoardListMenu
            list={list}
            onDelete={() => onListDelete(list.id)}
            onArchive={(archived) => onListArchive?.(list.id, archived)}
            onColorChange={(color) => onListUpdate({ ...list, color })}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <SortableContext
          items={list.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-1.5">
            {list.cards.map((card) => {
              const showLineBefore =
                isDraggingCardOverThisList &&
                draggingCardId !== card.id &&
                overCardId === card.id;
              return (
                <Fragment key={card.id}>
                  {showLineBefore ? <DropLine orientation="horizontal" /> : null}
                  <CardItem card={card} boardId={list.boardId} orderedCardIds={orderedCardIds} />
                </Fragment>
              );
            })}
            {/* Drop na konci listu: over je list ID (nebo prázdný list) */}
            {isDraggingCardOverThisList && overCardId === null ? (
              <DropLine orientation="horizontal" />
            ) : null}
          </div>
        </SortableContext>

        {completedCount > 0 ? (
          <div className="mt-2 px-1 text-[11px] text-[var(--list-cta-text)] opacity-60">
            {completedCount} dokončeno
          </div>
        ) : null}

        {!quickAddOpen ? (
          <button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-[var(--list-cta-text)] opacity-70 transition-all hover:bg-[var(--list-pill-bg)] hover:opacity-100"
          >
            <Plus className="size-3.5" strokeWidth={2} /> Nová karta
          </button>
        ) : null}

        <CardQuickAdd
          listId={list.id}
          open={quickAddOpen}
          onOpenChange={setQuickAddOpen}
          onCreated={(card) => onCardCreated?.(list.id, card)}
        />
      </div>
    </div>
  );
}

/**
 * Static snapshot sloupce pro <DragOverlay>. Jen header + count, žádné karty
 * (jinak by se nested SortableContext registroval do DndContext s duplikátními ID).
 */
export function BoardListColumnDragOverlay({ list }: { list: ListData }) {
  const colorPreset = findListColor(list.color);
  const totalCount = list.cards.length;
  return (
    <div
      className="flex w-[260px] flex-col rounded-lg p-2 shadow-2xl rotate-1"
      style={{
        backgroundColor: colorPreset.bgTint,
      }}
    >
      <div className="flex h-11 items-center gap-2 px-1">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: colorPreset.dot }}
          aria-hidden
        />
        <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
          {list.name}
        </h3>
        <span
          className="ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs tabular-nums"
          style={{ backgroundColor: colorPreset.pillBg, color: colorPreset.ctaText }}
        >
          {totalCount}
        </span>
      </div>
    </div>
  );
}
