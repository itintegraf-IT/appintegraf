"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { addDays, differenceInDays, parseISO } from "date-fns";
import { CalendarDays, Monitor, SearchX } from "lucide-react";
import { useOptimisticListsMutation } from "@/hooks/projekty/useOptimisticListsMutation";
import { type ListData } from "./BoardListColumn";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarGrid } from "./CalendarGrid";
import { Button } from "@/components/projekty/ui/button";
import { EmptyState } from "@/components/projekty/ui/empty-state";
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
  const mutateLists = useOptimisticListsMutation({ lists, setLists });

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

    const payload: { dueDate: string; startDate?: string } = { dueDate: newDueDateIso };
    if (newStartDateIso) payload.startDate = newStartDateIso;

    // Undo podklad: původní hodnoty z aktuálního stavu
    const origCard = lists.flatMap((l) => l.cards).find((c) => c.id === cardId);
    const origDueIso = origCard?.dueDate
      ? new Date(origCard.dueDate).toISOString()
      : null;
    const origStartIso = origCard?.startDate
      ? new Date(origCard.startDate).toISOString()
      : null;

    await mutateLists({
      optimistic: (prev) =>
        prev.map((l) => ({
          ...l,
          cards: l.cards.map((c) => {
            if (c.id !== cardId) return c;
            return {
              ...c,
              dueDate: newDueDateIso,
              startDate: newStartDateIso ?? c.startDate,
            };
          }),
        })),
      request: () =>
        fetch(`/api/projekty/cards/${cardId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
      errorMessage: "Posun data selhal",
      successToast: {
        message:
          deltaDays > 0
            ? `Termín posunut o ${deltaDays} ${deltaDays === 1 ? "den" : deltaDays < 5 ? "dny" : "dní"} vpřed`
            : `Termín posunut o ${-deltaDays} ${-deltaDays === 1 ? "den" : -deltaDays < 5 ? "dny" : "dní"} zpět`,
        undo: async () => {
          const undoPayload: { dueDate: string | null; startDate: string | null } = {
            dueDate: origDueIso,
            startDate: origStartIso,
          };
          const r = await fetch(`/api/projekty/cards/${cardId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(undoPayload),
          });
          return r.ok;
        },
      },
    });
  }

  if (isMobile) {
    return (
      <EmptyState
        icon={Monitor}
        title="Kalendář je dostupný na desktopu"
        description="Na mobilu použij zobrazení List."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const sp = new URLSearchParams(searchParams.toString());
              sp.set("view", "list");
              sp.delete("month");
              router.replace(`${pathname}?${sp.toString()}`);
            }}
          >
            Přepnout na List
          </Button>
        }
        className="m-4 flex-1"
      />
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
        <EmptyState
          icon={SearchX}
          title="Žádné karty neodpovídají filtru"
          action={
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Vymazat filtry
            </Button>
          }
          className="m-4 flex-1"
        />
      </div>
    );
  }

  if (totalPills === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <CalendarHeader />
        <CalendarGrid weeks={weeks} />
        <EmptyState
          icon={CalendarDays}
          title="Žádné karty s daty v tomto měsíci"
          action={
            <Button variant="outline" size="sm" onClick={switchToKanban}>
              Přepnout na Kanban
            </Button>
          }
          className="m-4"
        />
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
