"use client";

import { useMemo, useState } from "react";
import { format, isSameDay, startOfDay } from "date-fns";
import { cs } from "date-fns/locale";
import { BellRing } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ReminderListItem, type ReminderItem } from "./ReminderListItem";
import { REMINDER_DOT_COLOR, type ReminderType } from "@/lib/crm/reminder";
import { cn } from "@/lib/utils";

export type ReminderRow = {
  id: string;
  type: ReminderType;
  date: string;
  note: string | null;
  completed_at: string | null;
  parent: { type: "COMPANY" | "DEAL" | "CONTACT"; id: string; name: string };
};

type Props = {
  reminders: ReminderRow[];
};

export function RemindersWidgetClient({ reminders }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));

  const items: ReminderItem[] = useMemo(
    () =>
      reminders.map((r) => ({
        id: r.id,
        type: r.type,
        date: new Date(r.date),
        note: r.note,
        completed_at: r.completed_at ? new Date(r.completed_at) : null,
        parent: r.parent,
      })),
    [reminders],
  );

  const datesByDay = useMemo(() => {
    const map = new Map<string, ReminderItem[]>();
    for (const r of items) {
      const key = format(new Date(r.date), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return map;
  }, [items]);

  const overdueItems = useMemo(
    () => items.filter((r) => startOfDay(new Date(r.date)).getTime() < startOfDay(new Date()).getTime()),
    [items],
  );

  const dayItems = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    return datesByDay.get(key) ?? [];
  }, [datesByDay, selectedDate]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-foreground">
          <BellRing className="size-4 text-amber-500" strokeWidth={1.75} />
          Připomenutí
        </h3>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setSelectedDate(startOfDay(new Date()))}
        >
          Dnes
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(d) => d && setSelectedDate(startOfDay(d))}
          className="rounded-md border bg-background"
          components={{
            DayButton: ({ day, modifiers: _modifiers, className: cls, ...props }) => {
              const key = format(day.date, "yyyy-MM-dd");
              const types = new Set((datesByDay.get(key) ?? []).map((r) => r.type));
              return (
                <button {...props} className={cn(cls, "relative")} type="button">
                  {day.date.getDate()}
                  {types.size > 0 ? (
                    <span className="pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {[...types].slice(0, 3).map((t) => (
                        <span key={t} className={cn("size-1.5 rounded-full", REMINDER_DOT_COLOR[t])} />
                      ))}
                    </span>
                  ) : null}
                </button>
              );
            },
          }}
        />

        <div className="min-w-0">
          {overdueItems.length > 0 && isSameDay(selectedDate, new Date()) ? (
            <div className="mb-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-600">
                Overdue ({overdueItems.length})
              </p>
              <ul className="space-y-2">
                {overdueItems.map((r) => (
                  <ReminderListItem key={r.id} reminder={r} />
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {format(selectedDate, "EEEE d. M. yyyy", { locale: cs })}
          </p>
          {dayItems.length === 0 ? (
            <EmptyState
              icon={BellRing}
              title="Žádné připomenutí"
              description="Pro tento den žádné připomenutí."
            />
          ) : (
            <ul className="space-y-2">
              {dayItems.map((r) => (
                <ReminderListItem key={r.id} reminder={r} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
