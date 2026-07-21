"use client";

import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/projekty/utils";

export type TodoStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

const STATUS_LABEL: Record<TodoStatus, string> = {
  NOT_STARTED: "K vyřízení",
  IN_PROGRESS: "Rozpracováno",
  DONE: "Hotovo",
};

const STATUS_ORDER: TodoStatus[] = ["NOT_STARTED", "IN_PROGRESS", "DONE"];

/** Cyklus: NOT_STARTED → IN_PROGRESS → DONE → NOT_STARTED */
export function nextStatus(s: TodoStatus): TodoStatus {
  const i = STATUS_ORDER.indexOf(s);
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length] ?? "NOT_STARTED";
}

/** Multi-state checkbox (Notion-style):
 * - NOT_STARTED: empty box
 * - IN_PROGRESS: amber fill with minus
 * - DONE: primary fill with check
 *
 * Click cycles through 3 states. Hover ukazuje tooltip "Stav: …" přes title attr.
 */
export function TodoStatusCheckbox({
  status,
  onChange,
  disabled,
  size = "md",
  stopPropagation = true,
}: {
  status: TodoStatus;
  onChange: (next: TodoStatus) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  /** Default true — pro použití v clickable row */
  stopPropagation?: boolean;
}) {
  const dim =
    size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-5";
  const iconDim =
    size === "sm" ? "size-3" : size === "lg" ? "size-4" : "size-3.5";

  return (
    <button
      type="button"
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        onChange(nextStatus(status));
      }}
      disabled={disabled}
      title={`Stav: ${STATUS_LABEL[status]}`}
      aria-label={`Stav: ${STATUS_LABEL[status]}. Klikni pro změnu.`}
      className={cn(
        "grid shrink-0 place-items-center rounded-md border transition-all",
        dim,
        status === "DONE" &&
          "border-primary bg-primary text-primary-foreground",
        status === "IN_PROGRESS" &&
          "border-amber-500 bg-amber-500 text-white",
        status === "NOT_STARTED" &&
          "border-[hsl(var(--notion-fg)/0.25)] hover:border-[hsl(var(--notion-fg)/0.5)] hover:bg-[hsl(var(--notion-fg)/0.04)]",
      )}
    >
      {status === "DONE" && <Check className={iconDim} strokeWidth={2.5} />}
      {status === "IN_PROGRESS" && <Minus className={iconDim} strokeWidth={3} />}
    </button>
  );
}

export const TODO_STATUS_LABEL = STATUS_LABEL;
