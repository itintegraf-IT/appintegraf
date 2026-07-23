"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { UserAvatar } from "@/components/projekty/UserAvatar";
import { type CalendarPill } from "@/lib/projekty/calendar";

export function CalendarCardPill({ pill }: { pill: CalendarPill }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const card = pill.card;
  const primaryMember = card.members[0]?.user;
  const labelColor = card.labels[0]?.label.color ?? "hsl(215 16% 47%)";

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: {
      type: "card",
      cardDates: { startDate: card.startDate, dueDate: card.dueDate },
    },
  });

  const style: React.CSSProperties = {
    borderLeft: `3px solid ${labelColor}`,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
  };

  function openDetail(e: React.MouseEvent) {
    e.stopPropagation();
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("card", card.id);
    router.replace(`${pathname}?${sp.toString()}`);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail(e as unknown as React.MouseEvent);
        }
      }}
      title={card.title}
      className={`group flex w-full cursor-grab touch-none items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] transition-colors hover:bg-[hsl(var(--notion-fg)/0.06)] active:cursor-grabbing ${
        card.completed ? "opacity-60" : ""
      }`}
    >
      {pill.continuesLeft ? (
        <ChevronLeft className="size-3 shrink-0 text-[hsl(var(--notion-fg)/0.5)]" />
      ) : null}
      <span
        className={`flex-1 truncate ${
          card.completed ? "line-through text-[hsl(var(--notion-fg)/0.5)]" : "text-[hsl(var(--notion-fg))]"
        }`}
      >
        {card.title}
      </span>
      {primaryMember ? (
        <UserAvatar user={primaryMember} size="xs" className="shrink-0" />
      ) : null}
      {pill.continuesRight ? (
        <ChevronRight className="size-3 shrink-0 text-[hsl(var(--notion-fg)/0.5)]" />
      ) : null}
    </div>
  );
}
