"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListTodo, CheckCircle2, Sparkles } from "lucide-react";
import type { PersonalTodo } from "@prisma/client";
import { cn } from "@/lib/projekty/utils";
import { PersonalTodoInlineAdd } from "@/components/projekty/todos/PersonalTodoInlineAdd";
import { PersonalTodoRow } from "@/components/projekty/todos/PersonalTodoRow";
import { PersonalTodoArchive } from "@/components/projekty/todos/PersonalTodoArchive";
import { PromoteToProjectModal } from "@/components/projekty/todos/PromoteToProjectModal";
import { PersonalTodoDetailSheet } from "@/components/projekty/todos/PersonalTodoDetailSheet";

export type ArchivedTodo = PersonalTodo & {
  promotedToCard:
    | {
        id: string;
        number: string;
        title: string;
        list: { board: { id: string; name: string } };
      }
    | null;
};

export type BoardLite = {
  id: string;
  name: string;
  lists: { id: string; name: string; position: number }[];
};

type Tab = "active" | "completed";

export function PersonalTodoView({
  initialActive,
  initialCompleted,
  initialArchived,
  boards,
}: {
  initialActive: PersonalTodo[];
  initialCompleted: PersonalTodo[];
  initialArchived: ArchivedTodo[];
  boards: BoardLite[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const [promoteTodo, setPromoteTodo] = useState<PersonalTodo | null>(null);
  const [detailTodoId, setDetailTodoId] = useState<string | null>(null);

  const visible = tab === "active" ? initialActive : initialCompleted;

  // Sheet drží aktuální todo přes id (ne přes celý objekt) — po router.refresh()
  // se dostaneme k fresh datům z initialActive/initialCompleted.
  const detailTodo =
    detailTodoId
      ? initialActive.find((t) => t.id === detailTodoId) ??
        initialCompleted.find((t) => t.id === detailTodoId) ??
        null
      : null;

  function refetch() {
    router.refresh();
  }

  function openDetail(todo: PersonalTodo) {
    setDetailTodoId(todo.id);
  }

  return (
    <>
      <PromoteToProjectModal
        todo={promoteTodo}
        boards={boards}
        open={promoteTodo !== null}
        onOpenChange={(v) => !v && setPromoteTodo(null)}
      />

      <PersonalTodoDetailSheet
        todo={detailTodo}
        open={detailTodo !== null}
        onOpenChange={(v) => !v && setDetailTodoId(null)}
        onMutated={refetch}
        onPromoteClick={(t) => {
          setDetailTodoId(null);
          setPromoteTodo(t);
        }}
      />

      <div className="min-h-[calc(100dvh-3rem)] bg-[hsl(var(--notion-canvas))]">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <header className="mb-8">
            <div className="flex items-start gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-[hsl(var(--notion-fg)/0.05)] text-2xl">
                ✅
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-bold tracking-tight text-[hsl(var(--notion-fg))]">
                  Můj To Do list
                </h1>
                <p className="pt-1 text-sm text-[hsl(var(--notion-fg)/0.6)]">
                  Osobní úkoly. Stiskni{" "}
                  <kbd className="rounded border border-[hsl(var(--notion-fg)/0.15)] bg-background px-1.5 py-0.5 text-[11px] font-medium">
                    ⌘K
                  </kbd>{" "}
                  pro rychlé přidání odkudkoli.
                </p>
              </div>
            </div>
          </header>

          {/* Tabs jako pill group (Notion-style) */}
          <div className="mb-4 inline-flex items-center gap-1 rounded-lg border border-[hsl(var(--notion-fg)/0.08)] bg-background p-1">
            <TabButton
              active={tab === "active"}
              onClick={() => setTab("active")}
              icon={<ListTodo className="size-3.5" />}
              label="K vyřízení"
              count={initialActive.length}
            />
            <TabButton
              active={tab === "completed"}
              onClick={() => setTab("completed")}
              icon={<CheckCircle2 className="size-3.5" />}
              label="Hotovo"
              count={initialCompleted.length}
            />
          </div>

          {/* List */}
          <div className="overflow-hidden rounded-xl border border-[hsl(var(--notion-fg)/0.08)] bg-background shadow-sm">
            {visible.length === 0 ? (
              <EmptyState tab={tab} />
            ) : (
              <ul className="divide-y divide-[hsl(var(--notion-fg)/0.06)]">
                {visible.map((todo) => (
                  <PersonalTodoRow
                    key={todo.id}
                    todo={todo}
                    selected={todo.id === detailTodoId}
                    onMutated={refetch}
                    onOpen={openDetail}
                    onPromoteClick={setPromoteTodo}
                  />
                ))}
              </ul>
            )}
            {tab === "active" && (
              <div className="border-t border-[hsl(var(--notion-fg)/0.06)]">
                <PersonalTodoInlineAdd onCreated={refetch} />
              </div>
            )}
          </div>

          <PersonalTodoArchive archived={initialArchived} onMutated={refetch} />
        </div>
      </div>
    </>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-[hsl(var(--notion-fg)/0.06)] text-[hsl(var(--notion-fg))]"
          : "text-[hsl(var(--notion-fg)/0.55)] hover:text-[hsl(var(--notion-fg))]",
      )}
    >
      {icon}
      {label}
      <span
        className={cn(
          "ml-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold",
          active
            ? "bg-[hsl(var(--notion-fg)/0.08)] text-[hsl(var(--notion-fg)/0.7)]"
            : "text-[hsl(var(--notion-fg)/0.5)]",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  if (tab === "active") {
    return (
      <div className="grid place-items-center gap-2 py-12 text-center">
        <Sparkles className="size-6 text-[hsl(var(--notion-fg)/0.3)]" />
        <p className="text-sm font-medium text-[hsl(var(--notion-fg)/0.7)]">
          Žádné úkoly k vyřízení
        </p>
        <p className="text-xs text-[hsl(var(--notion-fg)/0.5)]">
          Napiš si první úkol dole, nebo stiskni{" "}
          <kbd className="rounded border border-[hsl(var(--notion-fg)/0.15)] bg-background px-1 text-[10px]">
            ⌘K
          </kbd>
          .
        </p>
      </div>
    );
  }
  return (
    <div className="py-10 text-center text-sm text-[hsl(var(--notion-fg)/0.5)]">
      Žádné hotové úkoly.
    </div>
  );
}
