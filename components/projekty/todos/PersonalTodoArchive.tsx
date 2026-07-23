"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, X, Archive } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { cn } from "@/lib/projekty/utils";
import type { ArchivedTodo } from "@/components/projekty/todos/PersonalTodoView";

export function PersonalTodoArchive({
  archived,
  onMutated,
}: {
  archived: ArchivedTodo[];
  onMutated: () => void;
}) {
  const [open, setOpen] = useState(false);

  async function remove(id: string) {
    if (!window.confirm("Smazat z historie?")) return;
    try {
      const res = await fetch(`/api/projekty/personal-todos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Smazáno z historie");
      onMutated();
    } catch {
      toast.error("Smazání se nezdařilo");
    }
  }

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--notion-fg)/0.55)] hover:text-[hsl(var(--notion-fg))]"
      >
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
        <Archive className="size-3.5" />
        Historie přesunů ({archived.length})
      </button>
      {open && (
        <div className="mt-2 overflow-hidden rounded-xl border border-[hsl(var(--notion-fg)/0.08)] bg-background">
          {archived.length === 0 ? (
            <div className="p-4 text-xs text-[hsl(var(--notion-fg)/0.5)]">
              Žádné přesunuté úkoly. Při přesunu úkolu do projektu se sem uloží odkaz na vytvořenou kartu.
            </div>
          ) : (
            <ul className="divide-y divide-[hsl(var(--notion-fg)/0.06)]">
              {archived.map((todo) => (
                <li
                  key={todo.id}
                  className="group flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-[hsl(var(--notion-fg)/0.02)]"
                >
                  <span className="flex-1 truncate text-[hsl(var(--notion-fg)/0.55)] line-through">
                    {todo.title}
                  </span>
                  {todo.archivedAt && (
                    <span className="shrink-0 text-xs text-[hsl(var(--notion-fg)/0.45)]">
                      {format(todo.archivedAt, "d. M. yyyy", { locale: cs })}
                    </span>
                  )}
                  {todo.promotedToCard && (
                    <Link
                      href={`/projekty/boards/${todo.promotedToCard.list.board.id}?card=${todo.promotedToCard.id}`}
                      className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      Otevřít kartu
                      <ExternalLink className="size-3" />
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void remove(todo.id)}
                    className="shrink-0 rounded p-1 text-[hsl(var(--notion-fg)/0.4)] opacity-0 transition-all hover:bg-[hsl(var(--notion-fg)/0.06)] hover:text-destructive group-hover:opacity-100"
                    aria-label="Smazat z historie"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
