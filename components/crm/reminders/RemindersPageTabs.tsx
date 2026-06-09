"use client";

import { useMemo } from "react";
import { BellRing, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { ReminderListItem, type ReminderItem } from "./ReminderListItem";
import type { ReminderRow } from "./RemindersWidgetClient";

type Props = {
  upcoming: ReminderRow[];
  completed: ReminderRow[];
};

function toItems(rows: ReminderRow[]): ReminderItem[] {
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    date: new Date(r.date),
    note: r.note,
    completed_at: r.completed_at ? new Date(r.completed_at) : null,
    parent: r.parent,
  }));
}

export function RemindersPageTabs({ upcoming, completed }: Props) {
  const upcomingItems = useMemo(() => toItems(upcoming), [upcoming]);
  const completedItems = useMemo(() => toItems(completed), [completed]);

  return (
    <Tabs defaultValue="upcoming" className="w-full">
      <TabsList variant="line" className="mb-4">
        <TabsTrigger value="upcoming">
          <BellRing className="size-4" strokeWidth={1.75} />
          Nadcházející
          <span className="ml-1 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
            {upcomingItems.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="completed">
          <CheckCircle2 className="size-4" strokeWidth={1.75} />
          Splněné
          <span className="ml-1 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
            {completedItems.length}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upcoming">
        {upcomingItems.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title="Žádná nadcházející připomenutí"
            description="Připomenutí přidáš tlačítkem na detailu firmy, kontaktu nebo obchodu."
          />
        ) : (
          <ul className="space-y-2">
            {upcomingItems.map((r) => (
              <ReminderListItem key={r.id} reminder={r} />
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="completed">
        {completedItems.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Zatím žádná splněná připomenutí"
            description="Až nějaké označíš jako hotová, najdeš je tady."
          />
        ) : (
          <ul className="space-y-2">
            {completedItems.map((r) => (
              <ReminderListItem key={r.id} reminder={r} />
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
