"use client";

import { useMemo, useState } from "react";
import { BellRing, AlertCircle, CheckCircle2, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { startOfDay } from "date-fns";
import { EmptyState } from "@/components/ui/empty-state";
import { ReminderListItem, type ReminderItem } from "./ReminderListItem";
import { DealReminderButton } from "./DealReminderButton";
import { type ReminderType } from "@/lib/crm/reminder";

export type DealReminderRow = {
  id: string;
  type: ReminderType;
  date: string;
  note: string | null;
  completed_at: string | null;
};

type Props = {
  deal: { id: string; title: string };
  reminders: DealReminderRow[];
  canAdd: boolean;
};

export function DealRemindersTab({ deal, reminders, canAdd }: Props) {
  const [showCompleted, setShowCompleted] = useState(false);

  const items: ReminderItem[] = useMemo(
    () =>
      reminders.map((r) => ({
        id: r.id,
        type: r.type,
        date: new Date(r.date),
        note: r.note,
        completed_at: r.completed_at ? new Date(r.completed_at) : null,
        parent: { type: "DEAL" as const, id: deal.id, name: deal.title },
      })),
    [reminders, deal.id, deal.title],
  );

  const today = startOfDay(new Date()).getTime();

  const overdue = useMemo(
    () => items.filter((r) => !r.completed_at && startOfDay(new Date(r.date)).getTime() < today),
    [items, today],
  );
  const upcoming = useMemo(
    () =>
      items
        .filter((r) => !r.completed_at && startOfDay(new Date(r.date)).getTime() >= today)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [items, today],
  );
  const completed = useMemo(
    () =>
      items
        .filter((r) => r.completed_at !== null)
        .sort(
          (a, b) =>
            new Date(b.completed_at as Date).getTime() - new Date(a.completed_at as Date).getTime(),
        ),
    [items],
  );

  const totalActive = overdue.length + upcoming.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BellRing className="size-5 text-amber-500" strokeWidth={1.75} />
            Připomenutí
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {totalActive === 0
              ? completed.length === 0
                ? "Žádné připomenutí k tomuto obchodu."
                : "Vše splněno."
              : `${totalActive} aktivních (${overdue.length} overdue, ${upcoming.length} nadcházejících)`}
          </p>
        </div>
        {canAdd ? <DealReminderButton deal={deal} /> : null}
      </div>

      {overdue.length > 0 ? (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-600">
            <AlertCircle className="size-3.5" strokeWidth={2.2} />
            Overdue ({overdue.length})
          </h3>
          <ul className="space-y-2">
            {overdue.map((r) => (
              <ReminderListItem key={r.id} reminder={r} />
            ))}
          </ul>
        </section>
      ) : null}

      {upcoming.length > 0 ? (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="size-3.5" strokeWidth={2.2} />
            Nadcházející ({upcoming.length})
          </h3>
          <ul className="space-y-2">
            {upcoming.map((r) => (
              <ReminderListItem key={r.id} reminder={r} />
            ))}
          </ul>
        </section>
      ) : null}

      {totalActive === 0 && completed.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="Žádné připomenutí"
          description={
            canAdd
              ? 'Klikni na "Připomenout se" a nastav si datum, kdy se k tomuto obchodu vrátit.'
              : "Připomenutí ti zatím nikdo nepřidal."
          }
        />
      ) : null}

      {completed.length > 0 ? (
        <section>
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            className="mb-2 flex w-full items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 transition-colors hover:text-emerald-800"
          >
            <CheckCircle2 className="size-3.5" strokeWidth={2.2} />
            Splněné ({completed.length})
            {showCompleted ? (
              <ChevronUp className="ml-auto size-3.5" />
            ) : (
              <ChevronDown className="ml-auto size-3.5" />
            )}
          </button>
          {showCompleted ? (
            <ul className="space-y-2">
              {completed.map((r) => (
                <ReminderListItem key={r.id} reminder={r} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
