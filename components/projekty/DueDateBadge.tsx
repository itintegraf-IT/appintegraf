import { Calendar } from "lucide-react";
import { cn } from "@/lib/projekty/utils";
import {
  formatDue,
  getDueStatus,
  type DueFormatVariant,
} from "@/lib/projekty/due-date";

/**
 * Jednotný chip termínu: po termínu rose, dnes amber, jinak neutrální bez
 * pozadí. Dokončené položky se nebarví (hotové nehoří). Dark mode přes
 * poloprůhledný sytý tón (bg-*-500/15), viz components/projekty/CLAUDE.md.
 */
export function DueDateBadge({
  due,
  completed,
  variant = "short",
  showIcon = true,
  className,
}: {
  due: Date | string | null | undefined;
  completed: boolean;
  variant?: DueFormatVariant;
  showIcon?: boolean;
  className?: string;
}) {
  if (!due) return null;
  const status = getDueStatus(due, completed);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs tabular-nums",
        status === "overdue" && "bg-rose-500/15 text-rose-700 dark:text-rose-400",
        status === "today" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        (status === "upcoming" || status === "none") && "text-muted-foreground",
        className,
      )}
    >
      {showIcon && <Calendar className="size-3 shrink-0" />}
      {formatDue(due, variant)}
    </span>
  );
}
