"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/projekty/utils";

/**
 * Sticky hlavička skupiny v list view. Droppable jen když skupina odpovídá
 * sloupci (group=list) — u due/assignee projekcí je drag disabled.
 */
export function ListGroupHeader({
  groupKey,
  label,
  dotColor,
  totalCount,
  completedCount,
  droppableListId,
}: {
  groupKey: string;
  label: string;
  dotColor: string | null;
  totalCount: number;
  completedCount: number;
  droppableListId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-${groupKey}`,
    data: { type: "group", listId: droppableListId },
    disabled: droppableListId == null,
  });
  return (
    <header
      ref={setNodeRef}
      className={cn(
        "sticky top-0 z-10 flex items-center gap-2 border-b border-border px-4 py-2 backdrop-blur transition-colors",
        isOver && droppableListId != null ? "bg-blue-500/10" : "bg-background/95",
      )}
    >
      {dotColor ? (
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden
        />
      ) : null}
      <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
        {label}
      </h3>
      <span className="ml-auto text-xs tabular-nums text-muted-foreground/70">
        {totalCount}
        {completedCount > 0 ? ` · ${completedCount} hotovo` : ""}
      </span>
    </header>
  );
}
