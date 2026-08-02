"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, CheckSquare } from "lucide-react";
import { UserAvatar } from "@/components/projekty/UserAvatar";
import { DueDateBadge } from "@/components/projekty/DueDateBadge";
import { LabelChip } from "@/components/projekty/LabelChip";
import { PriorityChip } from "@/components/projekty/PriorityChip";
import type { CardPriorityValue } from "@/lib/projekty/priority";
import { cn } from "@/lib/projekty/utils";
import { useBulkSelection } from "./BulkSelectionContext";
import { useIsTouchDevice } from "@/hooks/projekty/useIsTouchDevice";

type UserLite = { id: number; email: string | null; name: string | null; image: string | null };

export type CardData = {
  id: string;
  number: string;
  listId: string;
  boardId: string;
  title: string;
  description: string | null;
  position: number;
  dueDate: Date | string | null;
  startDate: Date | string | null;
  completed: boolean;
  cover: string | null;
  archived: boolean;
  priority: CardPriorityValue | null;
  members: { userId: number; user: UserLite }[];
  labels: { labelId: string; label: { id: string; name: string; color: string } }[];
  notesCount?: number;
  attachmentsCount?: number;
  _count?: { checklists: number };
  checklistDone?: number;
  checklistTotal?: number;
};

/**
 * Pure visual content of a card. Used by both CardItem (sortable) and
 * CardItemDragOverlay (rendered by BoardView's <DragOverlay>).
 */
function CardItemBody({
  card,
  boardId,
  asLink,
}: {
  card: CardData;
  boardId: string;
  asLink: boolean;
}) {
  const due = card.dueDate ? new Date(card.dueDate) : null;
  const primaryMember = card.members[0]?.user;
  const extraMembersCount = card.members.length - 1;
  const primaryLabel = card.labels[0]?.label;
  const extraLabelsCount = card.labels.length - 1;

  const checklistTotal = card.checklistTotal ?? 0;
  const checklistDone = card.checklistDone ?? 0;
  // Jen počet položek (done/total) — počet checklistů by ve stejném slotu
  // měnil význam čísla (karta jen s prázdnými checklisty counter nemá).
  const hasChecklist = checklistTotal > 0;
  const hasAnyMeta = Boolean(
    card.priority || primaryLabel || due || hasChecklist || primaryMember,
  );

  const content = (
    <div className="px-3 py-2">
      {card.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.cover}
          alt=""
          className="-mx-3 -mt-2 mb-2 h-[148px] w-[calc(100%+1.5rem)] rounded-t-lg object-cover"
          draggable={false}
        />
      ) : null}

      <div className="flex items-start gap-1.5">
        {card.completed ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        ) : null}
        <div
          className={`flex-1 text-sm font-medium leading-snug ${
            card.completed
              ? "text-muted-foreground/70 line-through"
              : "text-foreground"
          }`}
        >
          {card.title}
        </div>
      </div>

      {hasAnyMeta ? (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          {/* Tečka místo chipu — meta řádek kanban karty je nejtěsnější slot v modulu. */}
          <PriorityChip priority={card.priority} variant="dot" />
          {primaryLabel ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <LabelChip
                name={primaryLabel.name}
                color={primaryLabel.color}
                className="-my-0.5 max-w-[8rem]"
              />
              {extraLabelsCount > 0 ? (
                <span className="text-muted-foreground/70">+{extraLabelsCount}</span>
              ) : null}
            </span>
          ) : null}
          {due ? (
            <DueDateBadge due={due} completed={card.completed} className="-my-0.5" />
          ) : null}
          {hasChecklist ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 tabular-nums",
                checklistDone === checklistTotal && "text-emerald-600 dark:text-emerald-400",
              )}
            >
              <CheckSquare className="size-3" aria-hidden />
              {`${checklistDone}/${checklistTotal}`}
            </span>
          ) : null}
          {primaryMember ? (
            <span className="ml-auto inline-flex items-center gap-1">
              <UserAvatar user={primaryMember} size="xs" />
              {extraMembersCount > 0 ? (
                <span className="text-muted-foreground">+{extraMembersCount}</span>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (asLink) {
    return (
      <Link
        href={`/projekty/boards/${boardId}?card=${card.id}`}
        draggable={false}
        className="block overflow-hidden rounded-lg"
      >
        {content}
      </Link>
    );
  }
  return <div className="block overflow-hidden rounded-lg">{content}</div>;
}

export function CardItem({
  card,
  boardId,
  orderedCardIds,
}: {
  card: CardData;
  boardId: string;
  orderedCardIds: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: card.id,
      data: { type: "card", listId: card.listId },
    });

  const sel = useBulkSelection();
  const isSelected = sel.isSelected(card.id);
  const isTouch = useIsTouchDevice();

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function handleCardClick(e: React.MouseEvent) {
    // Bulk select je desktop-only (per ADR 0029). Na touch propusť default
    // Link navigaci pro každý click bez ohledu na modifier keys.
    if (isTouch) return;

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
    // Default: nechej Link navigaci proběhnout
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      aria-label={`Přesunout kartu ${card.title}`}
      data-bulk-card
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
      className={cn(
        "group relative cursor-grab touch-none rounded-lg border border-border bg-card transition-shadow hover:shadow-sm active:cursor-grabbing",
        // Ghost na původní pozici — vybledlý s čárkovaným okrajem (Linear vzor);
        // primární fokus je DragOverlay u kurzoru.
        isDragging && "border-dashed opacity-40",
        isSelected && !isTouch && "border-primary ring-1 ring-primary hover:shadow-none",
      )}
    >
      <CardItemBody card={card} boardId={boardId} asLink />
    </div>
  );
}

/**
 * Static visual snapshot of a card for the <DragOverlay> portal.
 * No drag listeners, no Link (= žádná navigace při drop).
 */
export function CardItemDragOverlay({ card, boardId }: { card: CardData; boardId: string }) {
  return (
    <div className="w-[244px] cursor-grabbing rounded-lg border border-border bg-card shadow-2xl rotate-2 scale-105">
      <CardItemBody card={card} boardId={boardId} asLink={false} />
    </div>
  );
}
