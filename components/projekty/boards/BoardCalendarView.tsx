"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { addDays, differenceInDays, parseISO } from "date-fns";
import { toast } from "sonner";
import { type ListData } from "./BoardListColumn";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarGrid } from "./CalendarGrid";
import { Button } from "@/components/projekty/ui/button";
import { buildMonthGrid } from "@/lib/projekty/calendar";
import { parseCalendarMonth } from "@/lib/projekty/board-view";
import { type CardData } from "./CardItem";
import { useResponsiveSensors } from "@/lib/projekty/dnd-sensors";

export function BoardCalendarView({
  displayedLists,
  lists,
  setLists,
}: {
  displayedLists: ListData[];
  lists: ListData[];
  setLists: React.Dispatch<React.SetStateAction<ListData[]>>;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const sensors = useResponsiveSensors();

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const overRaw = over.data.current;
    const activeRaw = active.data.current;
    const overType = overRaw && typeof overRaw["type"] === "string" ? overRaw["type"] : undefined;
    const overDate = overRaw && typeof overRaw["date"] === "string" ? overRaw["date"] : undefined;
    const activeType = activeRaw && typeof activeRaw["type"] === "string" ? activeRaw["type"] : undefined;
    const cardDatesRaw =
      activeRaw && typeof activeRaw["cardDates"] === "object" && activeRaw["cardDates"] !== null
        ? (activeRaw["cardDates"] as { startDate?: unknown; dueDate?: unknown })
        : undefined;
    if (overType !== "day" || !overDate) return;
    if (activeType !== "card" || !cardDatesRaw) return;

    const cardId = String(active.id);
    const newDate = parseISO(overDate);
    const rawDue = cardDatesRaw.dueDate;
    const rawStart = cardDatesRaw.startDate;
    if (!rawDue) return;

    const dueDateVal: Date | string =
      rawDue instanceof Date ? rawDue : typeof rawDue === "string" ? rawDue : null!;
    if (!dueDateVal) return;

    const oldDue = typeof dueDateVal === "string" ? parseISO(dueDateVal) : dueDateVal;
    const deltaDays = differenceInDays(newDate, oldDue);
    if (deltaDays === 0) return;

    const newDueDateIso = newDate.toISOString();
    const newStartDateIso =
      rawStart instanceof Date
        ? addDays(rawStart, deltaDays).toISOString()
        : typeof rawStart === "string"
          ? addDays(parseISO(rawStart), deltaDays).toISOString()
          : null;

    const original = lists;
    const newLists = lists.map((l) => ({
      ...l,
      cards: l.cards.map((c) => {
        if (c.id !== cardId) return c;
        return {
          ...c,
          dueDate: newDueDateIso,
          startDate: newStartDateIso ?? c.startDate,
        };
      }),
    }));
    setLists(newLists);

    const payload: { dueDate: string; startDate?: string } = { dueDate: newDueDateIso };
    if (newStartDateIso) payload.startDate = newStartDateIso;

    try {
      const res = await fetch(`/api/projekty/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setLists(original);
        toast.error("Posun data selhal.");
      }
    } catch {
      setLists(original);
      toast.error("Posun data selhal (chyba sítě).");
    }
  }

  if (isMobile) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
        <p className="text-sm">Calendar je dostupný na desktopu.</p>
        <Button
          variant="outline"
          onClick={() => {
            const sp = new URLSearchParams(searchParams.toString());
            sp.set("view", "list");
            sp.delete("month");
            router.replace(`${pathname}?${sp.toString()}`);
          }}
        >
          Přepnout na List
        </Button>
      </div>
    );
  }

  const { year, month } = parseCalendarMonth(searchParams);
  const allCards: CardData[] = displayedLists.flatMap((l) => l.cards);
  const cardsWithDates = allCards.filter((c) => c.dueDate ?? c.startDate);
  const weeks = buildMonthGrid({ year, month, cards: cardsWithDates });
  const totalPills = weeks.flatMap((w) => w.flatMap((d) => d.pills)).length;

  function clearFilters() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("q");
    sp.delete("members");
    sp.delete("labels");
    sp.delete("due");
    sp.delete("completed");
    router.replace(`${pathname}${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  function switchToKanban() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("view");
    sp.delete("month");
    router.replace(`${pathname}${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  const hasActiveFilters =
    searchParams.has("q") ||
    searchParams.has("members") ||
    searchParams.has("labels") ||
    searchParams.has("due") ||
    searchParams.has("completed");

  // Empty state s aktivním filtrem nahradíme grid celkem (uživatel chce vidět
  // "nic nematchne"). Bez filtru ukážeme grid normálně, jen s informací o
  // chybějících kartách POD ním — struktura kalendáře je sama o sobě užitečná.
  if (totalPills === 0 && hasActiveFilters) {
    return (
      <div className="flex flex-1 flex-col">
        <CalendarHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground/70">
          <p className="text-sm">Žádné karty odpovídající filtru.</p>
          <Button variant="outline" onClick={clearFilters}>
            Vymazat filtr
          </Button>
        </div>
      </div>
    );
  }

  if (totalPills === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <CalendarHeader />
        <CalendarGrid weeks={weeks} />
        <div className="flex flex-col items-center justify-center gap-2 border-t border-border p-3 text-muted-foreground/70">
          <p className="text-xs">Žádné karty s daty v tomto měsíci.</p>
          <Button variant="outline" size="sm" onClick={switchToKanban}>
            Přepnout na Kanban
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-1 flex-col">
        <CalendarHeader />
        <CalendarGrid weeks={weeks} />
      </div>
    </DndContext>
  );
}
