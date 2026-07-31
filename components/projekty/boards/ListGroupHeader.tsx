"use client";

import { useDroppable } from "@dnd-kit/core";
import { findListColor } from "@/lib/projekty/list-colors";
import { type ListData } from "./BoardListColumn";

export function ListGroupHeader({ list }: { list: ListData }) {
  const colorPreset = findListColor(list.color);
  const completedCount = list.cards.filter((c) => c.completed).length;
  const totalCount = list.cards.length;
  const { setNodeRef, isOver } = useDroppable({
    id: `group-${list.id}`,
    data: { type: "group", listId: list.id },
  });
  return (
    <header
      ref={setNodeRef}
      className={`sticky top-0 z-10 flex items-center gap-2 border-b border-border px-4 py-2 backdrop-blur transition-colors ${
        isOver
          ? "bg-blue-500/10"
          : "bg-background/95"
      }`}
    >
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: colorPreset.dot }}
        aria-hidden
      />
      <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
        {list.name}
      </h3>
      <span className="ml-auto text-xs tabular-nums text-muted-foreground/70">
        {totalCount}
        {completedCount > 0 ? ` · ${completedCount} hotovo` : ""}
      </span>
    </header>
  );
}
