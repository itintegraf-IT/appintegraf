"use client";

import Link from "next/link";
import { SquareKanban } from "lucide-react";
import type { PersonalTodo } from "@prisma/client";
import { DueDateBadge } from "@/components/projekty/DueDateBadge";
import { PriorityChip } from "@/components/projekty/PriorityChip";
import { TodoStatusCheckbox } from "@/components/projekty/todos/TodoStatusCheckbox";
import { cn } from "@/lib/projekty/utils";
import type { WorkItem } from "@/lib/projekty/my-work";

/**
 * Jeden řádek sjednoceného seznamu. Karta i osobní úkol vypadají stejně —
 * liší se jen kontextem vpravo (board · sloupec vs. „Osobní") a tím, kam
 * vedou: karta na deep-link `?card=`, osobní úkol otevře sheet.
 */
export function MyWorkRow({
  item,
  todo,
  onToggleCard,
  onTodoStatus,
  onOpenTodo,
  busy,
}: {
  item: WorkItem;
  /** Zdrojový záznam u osobního úkolu (kvůli stavu tři-stupňového checkboxu). */
  todo?: PersonalTodo;
  onToggleCard: (item: WorkItem) => void;
  onTodoStatus: (todo: PersonalTodo, next: PersonalTodo["status"]) => void;
  onOpenTodo: (todo: PersonalTodo) => void;
  busy: boolean;
}) {
  const body = (
    <>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px]",
          item.completed ? "text-muted-foreground/70 line-through" : "text-foreground",
        )}
      >
        {item.title}
      </span>

      {item.isNew ? (
        <span className="shrink-0 rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-400">
          Nové
        </span>
      ) : null}

      <PriorityChip priority={item.priority} className="hidden sm:inline-flex" />

      <span className="hidden w-44 shrink-0 items-center gap-1.5 text-xs text-muted-foreground md:flex">
        {item.kind === "card" ? (
          <SquareKanban className="size-3 shrink-0" aria-hidden />
        ) : null}
        <span className="truncate">{item.context ?? "Osobní úkol"}</span>
      </span>

      <span className="w-20 shrink-0 text-right">
        {item.due ? (
          <DueDateBadge due={item.due} completed={item.completed} showIcon={false} />
        ) : null}
      </span>
    </>
  );

  const rowClass =
    "group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-muted/50 motion-reduce:transition-none";

  if (item.kind === "todo" && todo) {
    return (
      <li className="border-b border-border/60 last:border-b-0">
        <div className={cn(rowClass, "cursor-pointer")}>
          <TodoStatusCheckbox
            status={todo.status}
            onChange={(next) => onTodoStatus(todo, next)}
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => onOpenTodo(todo)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            {body}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="border-b border-border/60 last:border-b-0">
      <div className={rowClass}>
        {/* aria-label nese název karty, ne akci — stav už sděluje aria-checked
            a bez názvu zní všechny řádky ve screen readeru stejně. */}
        <span
          role="checkbox"
          aria-checked={item.completed}
          aria-label={item.title}
          aria-disabled={busy}
          tabIndex={0}
          onClick={() => {
            if (!busy) onToggleCard(item);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!busy) onToggleCard(item);
            }
          }}
          className={cn(
            "grid size-4 shrink-0 cursor-pointer place-items-center rounded border border-border transition-colors duration-150 hover:bg-accent motion-reduce:transition-none",
            item.completed && "border-emerald-600 bg-emerald-600 dark:border-emerald-500 dark:bg-emerald-500",
            busy && "cursor-not-allowed opacity-50",
          )}
        >
          {item.completed ? (
            <svg viewBox="0 0 16 16" className="size-3 text-white" aria-hidden>
              <path
                d="M3.5 8.5l3 3 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </span>
        <Link
          href={item.href ?? "#"}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          {body}
        </Link>
      </div>
    </li>
  );
}
