"use client";

import { Tag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/projekty/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/projekty/ui/popover";
import { Checkbox } from "@/components/projekty/ui/checkbox";
import { useBulkSelection } from "./BulkSelectionContext";

type LabelLite = { id: string; name: string; color: string };

export function BulkLabelsPicker({
  labels,
  onApplied,
}: {
  labels: LabelLite[];
  onApplied: () => void;
}) {
  const sel = useBulkSelection();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function apply() {
    if (checked.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/projekty/cards/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addLabel",
          cardIds: [...sel.selectedIds],
          payload: { labelIds: [...checked] },
        }),
      });
      if (!res.ok) throw new Error("API error");
      toast.success(`Štítky přidány k ${sel.count} kartám`);
      sel.clear();
      onApplied();
      setOpen(false);
      setChecked(new Set());
    } catch {
      toast.error("Štítkování se nezdařilo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" disabled={busy}>
          <Tag className="mr-1 size-3.5" />
          Štítek
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="px-1 pb-1 text-xs font-medium uppercase text-muted-foreground">
          Přidat štítky
        </div>
        <div className="max-h-60 overflow-y-auto">
          {labels.map((l) => (
            <label
              key={l.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
            >
              <Checkbox
                checked={checked.has(l.id)}
                onCheckedChange={() => toggle(l.id)}
              />
              <span
                className="size-3 shrink-0 rounded"
                style={{ backgroundColor: l.color }}
                aria-hidden
              />
              <span className="text-sm">{l.name}</span>
            </label>
          ))}
        </div>
        <div className="pt-2">
          <Button
            size="sm"
            onClick={() => void apply()}
            disabled={busy || checked.size === 0}
          >
            Použít
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
