"use client";

import { useState } from "react";
import { MoreHorizontal, Trash2, ArrowRightCircle } from "lucide-react";
import type { PersonalTodo } from "@prisma/client";
import { TodoStatusCheckbox } from "@/components/projekty/todos/TodoStatusCheckbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { cn } from "@/lib/projekty/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/projekty/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/projekty/ui/alert-dialog";

export function PersonalTodoRow({
  todo,
  selected,
  onMutated,
  onOpen,
  onPromoteClick,
}: {
  todo: PersonalTodo;
  selected: boolean;
  onMutated: () => void;
  onOpen: (todo: PersonalTodo) => void;
  onPromoteClick: (todo: PersonalTodo) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projekty/personal-todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("API error");
      onMutated();
    } catch {
      toast.error("Změna se nezdařila");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projekty/personal-todos/${todo.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("API error");
      toast.success("Úkol smazán");
      setConfirmDelete(false);
      onMutated();
    } catch {
      toast.error("Smazání se nezdařilo");
    } finally {
      setBusy(false);
    }
  }

  const dueDate = todo.dueDate ? new Date(todo.dueDate) : null;
  const status = todo.status;
  const isDone = status === "DONE";

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(todo)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(todo);
          }
        }}
        className={cn(
          "group flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50",
          selected && "bg-muted/50",
        )}
      >
        <TodoStatusCheckbox
          status={status}
          onChange={(next) => void patch({ status: next })}
          disabled={busy}
        />

        <span
          className={cn(
            "flex-1 truncate text-sm",
            isDone
              ? "text-muted-foreground/70 line-through"
              : "text-foreground",
          )}
        >
          {todo.title}
        </span>

        {dueDate && (
          <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {format(dueDate, "d. M.", { locale: cs })}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded p-1 text-muted-foreground/70 opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label="Více akcí"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onPromoteClick(todo)} disabled={isDone}>
              <ArrowRightCircle className="mr-2 size-4" />
              Přesunout do projektu…
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setConfirmDelete(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-4" />
              Smazat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat úkol?</AlertDialogTitle>
            <AlertDialogDescription>
              Úkol „{todo.title}" bude trvale smazán. Tuto akci nelze vrátit zpět.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              {busy ? "Mažu…" : "Smazat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
