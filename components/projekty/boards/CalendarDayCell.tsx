"use client";

import { useDroppable } from "@dnd-kit/core";
import { type DayCell } from "@/lib/projekty/calendar";
import { cn } from "@/lib/projekty/utils";
import { CalendarCardPill } from "./CalendarCardPill";

export function CalendarDayCell({ cell }: { cell: DayCell }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${cell.iso}`,
    data: { type: "day", date: cell.iso },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[6rem] flex-col gap-0.5 border-b border-r border-border/60 p-1 transition-colors",
        isOver ? "bg-blue-500/15" : cell.outOfMonth ? "bg-muted/40" : "bg-background",
        cell.isToday && "ring-2 ring-inset ring-blue-500 dark:ring-blue-400"
      )}
    >
      <div
        className={cn(
          "text-right text-[11px] tabular-nums",
          cell.isToday
            ? "font-bold text-blue-600 dark:text-blue-400"
            : "text-muted-foreground/70"
        )}
      >
        {cell.date.getDate()}
      </div>
      <div className="flex flex-col gap-0.5">
        {cell.pills.map((pill, i) => (
          <CalendarCardPill key={`${pill.card.id}-${i}`} pill={pill} />
        ))}
      </div>
    </div>
  );
}
