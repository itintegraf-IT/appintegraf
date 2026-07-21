"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Columns, List as ListIcon, CalendarDays } from "lucide-react";
import { cn } from "@/lib/projekty/utils";
import { parseBoardView, type BoardViewType } from "@/lib/projekty/board-view";

type Tab = { value: BoardViewType; label: string; Icon: typeof Columns };

const TABS: Tab[] = [
  { value: "kanban", label: "Kanban", Icon: Columns },
  { value: "list", label: "Seznam", Icon: ListIcon },
  { value: "calendar", label: "Kalendář", Icon: CalendarDays },
];

export function BoardViewTabs() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const current = parseBoardView(searchParams);

  function handleSelect(value: BoardViewType) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value === "kanban") {
      sp.delete("view");
    } else {
      sp.set("view", value);
    }
    if (value !== "calendar") {
      sp.delete("month");
    }
    router.replace(
      `${pathname}${sp.toString() ? `?${sp.toString()}` : ""}`,
    );
  }

  return (
    <div
      role="tablist"
      aria-label="Přepínač pohledu"
      className="flex items-center gap-0.5 border-b border-[hsl(var(--notion-fg)/0.09)] bg-[hsl(var(--notion-canvas))] px-3 py-1.5"
    >
      {TABS.map(({ value, label, Icon }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => handleSelect(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors",
              active
                ? "bg-[hsl(var(--notion-fg)/0.08)] text-[hsl(var(--notion-fg))]"
                : "text-[hsl(var(--notion-fg)/0.6)] hover:bg-[hsl(var(--notion-fg)/0.06)] hover:text-[hsl(var(--notion-fg))]",
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
