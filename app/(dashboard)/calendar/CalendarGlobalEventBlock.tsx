"use client";

import Link from "next/link";
import type { CalendarGlobalBlockLines } from "@/lib/calendar-event-meta";

type Props = {
  lines: CalendarGlobalBlockLines;
  color: string;
  href: string;
  title?: string;
  compact?: boolean;
  draggable?: boolean;
  onDragStart?: (ev: React.DragEvent) => void;
  onClick?: (ev: React.MouseEvent) => void;
  className?: string;
};

export function CalendarGlobalEventBlock({
  lines,
  color,
  href,
  title,
  compact = false,
  draggable = false,
  onDragStart,
  onClick,
  className = "",
}: Props) {
  const barClass = compact
    ? "min-h-6 truncate border-l-4 pl-2 pr-1 py-0.5 text-left text-xs font-medium"
    : "min-h-8 border-l-4 pl-2 pr-1 py-0.5 text-left text-xs font-medium";

  const inner = (
    <>
      <span className="block truncate font-medium">{lines.headline}</span>
      {lines.timeRange && (
        <span className="block truncate text-[10px] font-normal opacity-90">{lines.timeRange}</span>
      )}
      {lines.subtitle && !compact && (
        <span className="block truncate text-[10px] font-normal opacity-80">{lines.subtitle}</span>
      )}
      {lines.status && (
        <span
          className={`block truncate text-[10px] font-normal ${
            lines.statusAlignRight ? "text-right" : ""
          } ${
            lines.status === "Schválen"
              ? "text-green-700"
              : lines.status.startsWith("Čeká")
                ? "text-inherit opacity-90"
                : ""
          }`}
        >
          {lines.status}
        </span>
      )}
    </>
  );

  const style = {
    borderLeftColor: color,
    backgroundColor: `${color}20`,
    color,
  };

  if (draggable) {
    return (
      <div
        draggable
        onDragStart={onDragStart}
        onClick={onClick}
        title={title}
        className={`${barClass} block cursor-grab overflow-hidden rounded-sm hover:opacity-90 active:cursor-grabbing ${className}`}
        style={style}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      title={title}
      className={`${barClass} block overflow-hidden rounded-sm hover:opacity-90 ${className}`}
      style={style}
    >
      {inner}
    </Link>
  );
}
