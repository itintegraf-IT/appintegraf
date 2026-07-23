"use client";

import { useDroppable } from "@dnd-kit/core";
import { type DayCell } from "@/lib/projekty/calendar";
import { CalendarCardPill } from "./CalendarCardPill";

export function CalendarDayCell({ cell }: { cell: DayCell }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${cell.iso}`,
    data: { type: "day", date: cell.iso },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[6rem] flex-col gap-0.5 border-b border-r border-[hsl(var(--notion-fg)/0.06)] p-1 transition-colors ${
        cell.outOfMonth ? "bg-[hsl(var(--notion-fg)/0.03)]" : "bg-[hsl(var(--notion-canvas))]"
      } ${cell.isToday ? "ring-2 ring-[hsl(var(--info))] ring-inset" : ""} ${
        isOver ? "bg-[hsl(var(--info)/0.15)]" : ""
      }`}
    >
      <div
        className={`text-right text-[11px] tabular-nums ${
          cell.outOfMonth ? "text-[hsl(var(--notion-fg)/0.3)]" : "text-[hsl(var(--notion-fg)/0.5)]"
        } ${cell.isToday ? "font-bold text-[hsl(var(--info))]" : ""}`}
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
