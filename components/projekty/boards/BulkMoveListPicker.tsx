"use client";

import { Move } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/projekty/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/projekty/ui/popover";
import { useBulkSelection } from "./BulkSelectionContext";

type ListLite = { id: string; name: string };

export function BulkMoveListPicker({
  lists,
  onMoved,
}: {
  lists: ListLite[];
  onMoved: () => void;
}) {
  const sel = useBulkSelection();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function move(targetListId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/projekty/cards/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          cardIds: [...sel.selectedIds],
          payload: { listId: targetListId },
        }),
      });
      if (!res.ok) throw new Error("API error");
      toast.success(`${sel.count} karet přesunuto`);
      sel.clear();
      onMoved();
      setOpen(false);
    } catch {
      toast.error("Přesun se nezdařil");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" disabled={busy}>
          <Move className="mr-1 size-3.5" />
          Přesunout
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div className="px-2 py-1 text-xs font-medium uppercase text-muted-foreground">
          Přesunout do sloupce
        </div>
        {lists.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => void move(l.id)}
            disabled={busy}
            className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
          >
            {l.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
