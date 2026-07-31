"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CheckCircle2, Calendar } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { cs } from "date-fns/locale";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { UserAvatar } from "@/components/projekty/UserAvatar";
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
}: {
  card: CardData;
  list: ListData;
  orderedCardIds: string[];
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
  const dueClass = due
    ? isPast(due) && !isToday(due) && !card.completed
      ? "bg-rose-100 text-rose-900"
      : isToday(due)
        ? "bg-amber-100 text-amber-900"
        : "bg-muted text-muted-foreground"
    : "";

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
    const next = !card.completed;
    await fetch(`/api/projekty/cards/${card.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completed: next }),
    });
    router.refresh();
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
          <CheckCircle2 className="size-4 text-emerald-600" strokeWidth={2} />
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
          <span
            key={l.labelId}
            className="inline-flex max-w-[5rem] items-center gap-1 truncate rounded-full px-1.5 py-0.5 text-[10px]"
            style={{ backgroundColor: `${l.label.color}22`, color: l.label.color }}
            title={l.label.name}
          >
            <span
              className="size-1 shrink-0 rounded-full"
              style={{ backgroundColor: l.label.color }}
              aria-hidden
            />
            {l.label.name}
          </span>
        ))}
        {extraLabelsCount > 0 ? (
          <span className="text-xs text-muted-foreground/70">+{extraLabelsCount}</span>
        ) : null}
      </span>

      {/* Due */}
      <span className="w-24 shrink-0 text-right">
        {due ? (
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${dueClass}`}
          >
            <Calendar className="size-3" />
            {format(due, "d. M.", { locale: cs })}
          </span>
        ) : null}
      </span>
    </div>
  );
}
