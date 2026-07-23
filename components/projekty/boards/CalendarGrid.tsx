"use client";

import { type Week } from "@/lib/projekty/calendar";
import { CalendarDayCell } from "./CalendarDayCell";

const DAY_NAMES = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

export function CalendarGrid({ weeks }: { weeks: Week[] }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="grid grid-cols-7 border-b border-[hsl(var(--notion-fg)/0.09)] bg-[hsl(var(--notion-fg)/0.04)]">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--notion-fg)/0.6)]"
          >
            {name}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6 overflow-y-auto">
        {weeks.flat().map((cell) => (
          <CalendarDayCell key={cell.iso} cell={cell} />
        ))}
      </div>
    </div>
  );
}
