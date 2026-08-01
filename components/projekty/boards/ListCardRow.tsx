"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { UserAvatar } from "@/components/projekty/UserAvatar";
import { DueDateBadge } from "@/components/projekty/DueDateBadge";
import { LabelChip } from "@/components/projekty/LabelChip";
import { findListColor } from "@/lib/projekty/list-colors";
import { cn } from "@/lib/projekty/utils";
import { useBulkSelection } from "./BulkSelectionContext";
import { useIsTouchDevice } from "@/hooks/projekty/useIsTouchDevice";
import { type CardData } from "./CardItem";
import { type ListData } from "./BoardListColumn";

export function ListCardRow({
  card,
  list,
  orderedCardIds,
  onToggleCompleted,
}: {
  card: CardData;
  list: ListData;
  orderedCardIds: string[];
  /** Optimistic toggle zvednutý do BoardListView (má přístup k lists stavu). */
  onToggleCompleted?: (card: CardData) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const colorPreset = findListColor(list.color);
  const sel = useBulkSelection();
  const isSelected = sel.isSelected(card.id);
  const isTouch = useIsTouchDevice();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: card.id,
      data: { type: "card", listId: list.id },
    });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const due = card.dueDate ? new Date(card.dueDate) : null;
  const primaryMember = card.members[0]?.user;
  const extraMembersCount = card.members.length - 1;
  const visibleLabels = card.labels.slice(0, 2);
  const extraLabelsCount = Math.max(0, card.labels.length - 2);

  function openDetail() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("card", card.id);
    router.replace(`${pathname}?${sp.toString()}`);
  }

  function handleRowClick(e: React.MouseEvent) {
    // Bulk select je desktop-only (per ADR 0029). Na touch otevři detail
    // pro každý tap bez ohledu na modifier keys.
    if (isTouch) return openDetail();

    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      sel.toggle(card.id);
      return;
    }
    if (e.shiftKey && sel.lastSelectedId) {
      e.preventDefault();
      e.stopPropagation();
      sel.selectRange(sel.lastSelectedId, card.id, orderedCardIds);
      return;
    }
    openDetail();
  }

  async function toggleCompleted(e: React.MouseEvent) {
    e.stopPropagation();
    if (onToggleCompleted) {
      onToggleCompleted(card);
      return;
    }
    // Fallback bez zvednutého handleru (neměl by nastat — BoardListView ho předává)
    const next = !card.completed;
    const res = await fetch(`/api/projekty/cards/${card.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completed: next }),
    });
    if (res.ok) router.refresh();
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      data-bulk-card
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail();
        }
      }}
      aria-label={`Karta ${card.title} — přesun nebo otevření`}
      className={cn(
        "group flex w-full cursor-grab touch-none items-center gap-3 border-b border-border/60 px-4 py-2 text-left transition-colors hover:bg-muted/50 active:cursor-grabbing",
        isSelected && !isTouch && "border-l-4 border-l-primary bg-primary/5",
      )}
    >
      {/* ☐ Completed */}
      <span
        role="checkbox"
        aria-checked={card.completed}
        aria-label={card.completed ? "Označit jako nedokončené" : "Označit jako hotové"}
        onClick={toggleCompleted}
        className="grid size-4 shrink-0 place-items-center rounded border border-border transition-colors hover:bg-accent"
      >
        {card.completed ? (
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
        ) : null}
      </span>

      {/* # number */}
      <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 tabular-nums">
        {card.number}
      </span>

      {/* Title */}
      <span
        className={`flex-1 truncate text-sm ${
          card.completed
            ? "text-muted-foreground/70 line-through"
            : "font-medium text-foreground"
        }`}
      >
        {card.title}
      </span>

      {/* Sloupec */}
      <span className="hidden w-32 shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: colorPreset.dot }}
          aria-hidden
        />
        <span className="truncate">{list.name}</span>
      </span>

      {/* Členové */}
      <span className="hidden w-24 shrink-0 items-center gap-1 sm:flex">
        {primaryMember ? <UserAvatar user={primaryMember} size="xs" /> : null}
        {extraMembersCount > 0 ? (
          <span className="text-xs text-muted-foreground/70">+{extraMembersCount}</span>
        ) : null}
      </span>

      {/* Labels */}
      <span className="hidden w-32 shrink-0 items-center gap-1 sm:flex">
        {visibleLabels.map((l) => (
          <LabelChip
            key={l.labelId}
            name={l.label.name}
            color={l.label.color}
            className="max-w-[5rem]"
          />
        ))}
        {extraLabelsCount > 0 ? (
          <span className="text-xs text-muted-foreground/70">+{extraLabelsCount}</span>
        ) : null}
      </span>

      {/* Due */}
      <span className="w-24 shrink-0 text-right">
        {due ? <DueDateBadge due={due} completed={card.completed} /> : null}
      </span>
    </div>
  );
}
