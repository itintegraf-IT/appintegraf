"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ListTodo } from "lucide-react";
import type { PersonalTodo } from "@prisma/client";
import { EmptyState } from "@/components/projekty/ui/empty-state";
import { Kbd } from "@/components/projekty/ui/kbd";
import { PersonalTodoInlineAdd } from "@/components/projekty/todos/PersonalTodoInlineAdd";
import { PersonalTodoArchive } from "@/components/projekty/todos/PersonalTodoArchive";
import { PersonalTodoDetailSheet } from "@/components/projekty/todos/PersonalTodoDetailSheet";
import { PromoteToProjectModal } from "@/components/projekty/todos/PromoteToProjectModal";
import type { ArchivedTodo, BoardLite } from "@/components/projekty/todos/types";
import { cn } from "@/lib/projekty/utils";
import { buildWorkSections, isRecentlyAssigned, type WorkItem } from "@/lib/projekty/my-work";
import type { CardPriorityValue } from "@/lib/projekty/priority";
import { MyWorkRow } from "./MyWorkRow";

export type MyWorkCard = {
  id: string;
  title: string;
  boardId: string;
  boardName: string;
  listName: string;
  dueDate: Date | null;
  completed: boolean;
  priority: CardPriorityValue | null;
  assignedAt: Date | null;
};

type Tab = "active" | "done";

export function MyWorkView({
  cards,
  todos,
  archived,
  boards,
}: {
  cards: MyWorkCard[];
  todos: PersonalTodo[];
  archived: ArchivedTodo[];
  boards: BoardLite[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const [promoteTodo, setPromoteTodo] = useState<PersonalTodo | null>(null);
  const [detailTodoId, setDetailTodoId] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  // Optimistic překryvy nad server daty — drží změnu, než doběhne refresh.
  // Čistí je výhradně refetch(); každá úspěšná mutace proto musí volat jeho,
  // ne holé router.refresh(), jinak override přebíjí čerstvá data napořád.
  const [cardOverrides, setCardOverrides] = useState<Record<string, boolean>>({});
  const [todoOverrides, setTodoOverrides] = useState<Record<string, PersonalTodo["status"]>>({});

  // Reset překryvů při příchodu čerstvých serverových dat (React pattern
  // „adjusting state when props change" — setState při renderu, ne v efektu).
  // Bez něj by override přebíjel server napořád: kdyby kartu odškrtl někdo
  // jiný, zůstala by tu zobrazená jako hotová až do tvrdého reloadu.
  const [lastServerData, setLastServerData] = useState<unknown>(cards);
  if (lastServerData !== cards) {
    setLastServerData(cards);
    setCardOverrides({});
    setTodoOverrides({});
  }

  const detailTodo = detailTodoId ? todos.find((t) => t.id === detailTodoId) ?? null : null;

  function refetch() {
    setCardOverrides({});
    setTodoOverrides({});
    router.refresh();
  }

  // Úkoly s aplikovaným optimistickým stavem — checkbox z nich počítá další
  // stav, takže druhý klik před dokončením refreshe nepošle tentýž cíl znovu.
  const effectiveTodos = useMemo(
    () =>
      todos.map((t) => {
        const override = todoOverrides[t.id];
        return override && override !== t.status ? { ...t, status: override } : t;
      }),
    [todos, todoOverrides],
  );

  const todoById = useMemo(
    () => new Map(effectiveTodos.map((t) => [t.id, t])),
    [effectiveTodos],
  );

  const items: WorkItem[] = useMemo(() => {
    const now = new Date();
    const cardItems: WorkItem[] = cards.map((c) => ({
      kind: "card",
      id: c.id,
      title: c.title,
      due: c.dueDate,
      completed: cardOverrides[c.id] ?? c.completed,
      priority: c.priority,
      isNew: isRecentlyAssigned(c.assignedAt, now),
      context: `${c.boardName} · ${c.listName}`,
      href: `/projekty/boards/${c.boardId}?card=${c.id}`,
    }));
    const todoItems: WorkItem[] = effectiveTodos.map((t) => ({
      kind: "todo",
      id: t.id,
      title: t.title,
      due: t.dueDate,
      completed: t.status === "DONE",
      // Osobní úkoly zatím prioritu nemají — sdílené řazení je bere jako „bez priority".
      priority: null,
      isNew: false,
      context: null,
      href: null,
    }));
    return [...cardItems, ...todoItems];
  }, [cards, effectiveTodos, cardOverrides]);

  const activeItems = items.filter((i) => !i.completed);
  const doneItems = items.filter((i) => i.completed);
  const visibleItems = tab === "active" ? activeItems : doneItems;
  const sections = buildWorkSections(visibleItems);

  function withBusy(id: string, on: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function patchCard(cardId: string, completed: boolean): Promise<boolean> {
    const res = await fetch(`/api/projekty/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    return res.ok;
  }

  function dropCardOverride(cardId: string) {
    setCardOverrides((prev) => {
      const copy = { ...prev };
      delete copy[cardId];
      return copy;
    });
  }

  async function toggleCard(item: WorkItem) {
    if (busyIds.has(item.id)) return;
    const next = !item.completed;
    setCardOverrides((prev) => ({ ...prev, [item.id]: next }));
    withBusy(item.id, true);

    // try/finally je nutné: odmítnutá promisa z fetch (offline, uspaný notebook)
    // není totéž co !res.ok — bez něj by zůstal viset optimistický stav i busy flag.
    try {
      const ok = await patchCard(item.id, next);
      if (!ok) {
        dropCardOverride(item.id);
        toast.error("Změna se nezdařila");
        return;
      }

      if (next) {
        toast.success(`Hotovo: ${item.title}`, {
          action: {
            label: "Zpět",
            onClick: () => {
              void patchCard(item.id, false)
                .then((undone) => {
                  if (undone) refetch();
                  else toast.error("Vrácení se nezdařilo");
                })
                .catch(() => toast.error("Vrácení se nezdařilo"));
            },
          },
        });
      }
      // Překryv nechávám — smaže ho až příchod čerstvých dat, takže řádek
      // mezi odpovědí API a dokončením refreshe neproblikne zpět.
      router.refresh();
    } catch {
      dropCardOverride(item.id);
      toast.error("Změna se nezdařila");
    } finally {
      withBusy(item.id, false);
    }
  }

  async function setTodoStatus(todo: PersonalTodo, next: PersonalTodo["status"]) {
    if (busyIds.has(todo.id)) return;
    setTodoOverrides((prev) => ({ ...prev, [todo.id]: next }));
    withBusy(todo.id, true);
    try {
      const res = await fetch(`/api/projekty/personal-todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("API error");
      // Překryv nechávám — smaže ho až příchod čerstvých dat, takže řádek
      // mezi odpovědí API a dokončením refreshe neproblikne zpět.
      router.refresh();
    } catch {
      setTodoOverrides((prev) => {
        const copy = { ...prev };
        delete copy[todo.id];
        return copy;
      });
      toast.error("Změna se nezdařila");
    } finally {
      withBusy(todo.id, false);
    }
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

      <div className="min-h-[calc(100dvh-3rem)] bg-background">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <header className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Moje práce</h1>
            <p className="pt-1 text-sm text-muted-foreground">
              Karty z nástěnek i osobní úkoly na jednom místě, seřazené podle naléhavosti.
              Rychlé přidání osobního úkolu odkudkoli: <Kbd shortcut="mod+shift+U" />.
            </p>
          </header>

          <div className="mb-4 inline-flex items-center gap-1 rounded-lg border border-border bg-background p-1">
            <TabButton
              active={tab === "active"}
              onClick={() => setTab("active")}
              icon={<ListTodo className="size-3.5" />}
              label="K vyřízení"
              count={activeItems.length}
            />
            <TabButton
              active={tab === "done"}
              onClick={() => setTab("done")}
              icon={<CheckCircle2 className="size-3.5" />}
              label="Hotovo"
              count={doneItems.length}
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-background">
            {sections.length === 0 ? (
              tab === "active" ? (
                <EmptyState
                  icon={ListTodo}
                  title="Nic tě nečeká"
                  description="Karty, kde jsi členem, a tvoje osobní úkoly se objeví tady."
                  className="m-3"
                />
              ) : (
                <EmptyState icon={CheckCircle2} title="Zatím nic hotového" className="m-3" />
              )
            ) : (
              sections.map((section) => (
                <section key={section.key}>
                  <h2 className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-1.5 text-xs font-semibold tracking-tight text-muted-foreground">
                    {section.label}
                    <span className="tabular-nums font-normal text-muted-foreground/70">
                      {section.items.length}
                    </span>
                  </h2>
                  <ul>
                    {section.items.map((item) => (
                      <MyWorkRow
                        key={`${item.kind}-${item.id}`}
                        item={item}
                        todo={item.kind === "todo" ? todoById.get(item.id) : undefined}
                        busy={busyIds.has(item.id)}
                        onToggleCard={(i) => void toggleCard(i)}
                        onTodoStatus={(t, next) => void setTodoStatus(t, next)}
                        onOpenTodo={(t) => setDetailTodoId(t.id)}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}

            {tab === "active" && (
              <div className="border-t border-border/60">
                <PersonalTodoInlineAdd onCreated={refetch} />
              </div>
            )}
          </div>

          <PersonalTodoArchive archived={archived} onMutated={refetch} />
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
      // Aktivní stav nesla jen barva pozadí — assistivní technologie o něm nevěděly.
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none",
        active
          ? "bg-muted font-semibold text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
      <span
        className={cn(
          "ml-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
          active ? "bg-muted text-muted-foreground" : "text-muted-foreground/70",
        )}
      >
        {count}
      </span>
    </button>
  );
}
