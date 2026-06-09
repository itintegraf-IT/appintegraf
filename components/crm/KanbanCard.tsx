"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { UserAvatar } from "@/components/crm/UserAvatar";

export type KanbanDeal = {
  id: string;
  number: string;
  title: string;
  value: number;
  probability: number;
  company: { name: string };
  owner: { id: number; name: string | null; email: string | null; image: string | null };
  category?: { color: string; label: string } | null;
};

export function KanbanCard({ deal, isOverlay = false }: { deal: KanbanDeal; isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    disabled: isOverlay,
  });
  const style = !isOverlay && transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0 : 1 }
    : undefined;

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      className="group flex gap-2 rounded-[var(--radius-card)] bg-card p-3 ring-1 ring-black/5 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]"
    >
      <button
        type="button"
        {...(isOverlay ? {} : listeners)}
        {...(isOverlay ? {} : attributes)}
        aria-label="Přetáhnout"
        className="-ml-1 mt-0.5 shrink-0 cursor-grab rounded text-muted-foreground/50 opacity-0 transition-opacity hover:text-muted-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring active:cursor-grabbing group-hover:opacity-100"
      >
        <GripVertical className="size-4" strokeWidth={1.75} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground tabular-nums">
          {deal.number}
        </div>
        <Link
          href={`/crm/deals/${deal.id}`}
          className="mt-0.5 block truncate text-sm font-medium text-foreground hover:underline"
        >
          {deal.title}
        </Link>
        <div className="mt-1 truncate text-xs text-muted-foreground">{deal.company.name}</div>
        {deal.category ? (
          <span
            className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: `${deal.category.color}22`, color: deal.category.color }}
          >
            <span className="size-1.5 rounded-full" style={{ backgroundColor: deal.category.color }} />
            {deal.category.label}
          </span>
        ) : null}
        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <UserAvatar user={deal.owner} size="xs" />
            <span className="text-foreground/80">{deal.value.toLocaleString("cs-CZ")} Kč</span>
          </div>
          <span className="text-muted-foreground">{deal.probability} %</span>
        </div>
      </div>
    </div>
  );
}
