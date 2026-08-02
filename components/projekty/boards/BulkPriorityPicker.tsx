"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/projekty/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/projekty/ui/popover";
import { cn } from "@/lib/projekty/utils";
import {
  CARD_PRIORITIES,
  PRIORITY_DOT_CLASSES,
  PRIORITY_LABELS,
  type CardPriorityValue,
} from "@/lib/projekty/priority";
import { useBulkSelection } from "./BulkSelectionContext";

type PriorityMap = Record<string, CardPriorityValue | null>;

async function setPriority(cardIds: string[], priority: CardPriorityValue | null) {
  const res = await fetch("/api/projekty/cards/bulk", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "setPriority", cardIds, payload: { priority } }),
  });
  if (!res.ok) throw new Error("API error");
}

export function BulkPriorityPicker({
  cardPriorities,
  onApplied,
}: {
  /** Priorita karet před akcí — jediný způsob, jak umět „Zpět" po hromadné změně. */
  cardPriorities: PriorityMap;
  onApplied: () => void;
}) {
  const sel = useBulkSelection();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function apply(priority: CardPriorityValue | null) {
    const ids = [...sel.selectedIds];
    // Snapshot PŘED akcí — po onApplied() už bude mapa přepsaná novou hodnotou.
    const before: PriorityMap = Object.fromEntries(
      ids.map((id) => [id, cardPriorities[id] ?? null]),
    );

    setBusy(true);
    try {
      await setPriority(ids, priority);
      setOpen(false);
      sel.clear();
      onApplied();

      toast.success(
        priority
          ? `Priorita „${PRIORITY_LABELS[priority]}" nastavena u ${ids.length} karet`
          : `Priorita odebrána u ${ids.length} karet`,
        {
          action: {
            label: "Zpět",
            onClick: () => {
              // Karty mohly mít různé původní priority → jeden request na skupinu.
              const groups = new Map<CardPriorityValue | null, string[]>();
              for (const id of ids) {
                const prev = before[id] ?? null;
                const bucket = groups.get(prev);
                if (bucket) bucket.push(id);
                else groups.set(prev, [id]);
              }
              void Promise.all(
                [...groups].map(([prev, groupIds]) => setPriority(groupIds, prev)),
              )
                .then(onApplied)
                .catch(() => toast.error("Vrácení priority selhalo."));
            },
          },
        },
      );
    } catch {
      toast.error("Nastavení priority se nezdařilo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" disabled={busy}>
          <Flag className="mr-1 size-3.5" />
          Priorita
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1">
        {CARD_PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            disabled={busy}
            onClick={() => void apply(p)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] transition-colors duration-150 hover:bg-muted disabled:opacity-50 motion-reduce:transition-none"
          >
            <span className={cn("size-2 rounded-full", PRIORITY_DOT_CLASSES[p])} aria-hidden />
            {PRIORITY_LABELS[p]}
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => void apply(null)}
          className="mt-1 flex w-full items-center rounded border-t px-2 py-1.5 pt-2 text-left text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-muted disabled:opacity-50 motion-reduce:transition-none"
        >
          Bez priority
        </button>
      </PopoverContent>
    </Popover>
  );
}
