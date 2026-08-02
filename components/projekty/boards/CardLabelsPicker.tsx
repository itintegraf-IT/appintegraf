"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/projekty/ui/popover";
import { Button } from "@/components/projekty/ui/button";
import { Tag, Check } from "lucide-react";
import { toast } from "sonner";

type Label = { id: string; name: string; color: string };

export function CardLabelsPicker({
  cardId,
  assignedLabelIds,
  boardLabels,
  onChange,
}: {
  cardId: string;
  assignedLabelIds: string[];
  boardLabels: Label[];
  onChange: (labelIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(label: Label) {
    setBusy(label.id);
    try {
      const res = await fetch(`/api/projekty/cards/${cardId}/labels`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ labelId: label.id }),
      });
      if (!res.ok) {
        toast.error("Úprava labelů selhala.");
        return;
      }
      const data = (await res.json()) as { added?: boolean; removed?: boolean };
      onChange(
        data.added
          ? [...assignedLabelIds, label.id]
          : assignedLabelIds.filter((id) => id !== label.id),
      );
    } catch {
      toast.error("Úprava labelů selhala (chyba sítě).");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Tag className="mr-2 size-4" />
          Labely ({assignedLabelIds.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="max-h-72 overflow-y-auto p-2">
          {boardLabels.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              Žádné labely. Vytvoř v nastavení boardu.
            </p>
          ) : (
            boardLabels.map((l) => {
              const assigned = assignedLabelIds.includes(l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => void toggle(l)}
                  disabled={busy === l.id}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/60 disabled:opacity-50"
                >
                  <span className="size-4 shrink-0 rounded" style={{ backgroundColor: l.color }} />
                  <span className="flex-1 text-sm">{l.name}</span>
                  {assigned ? <Check className="size-4 text-primary" /> : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
