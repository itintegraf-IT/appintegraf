"use client";

import { useState } from "react";
import { Flag, Check } from "lucide-react";
import { Button } from "@/components/projekty/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/projekty/ui/popover";
import { cn } from "@/lib/projekty/utils";
import {
  CARD_PRIORITIES,
  PRIORITY_DOT_CLASSES,
  PRIORITY_LABELS,
  type CardPriorityValue,
} from "@/lib/projekty/priority";

/**
 * Volba priority karty. `null` je plnohodnotná volba („Bez priority"), ne
 * pátý stupeň — proto vlastní položka a ne jen zrušení výběru.
 */
export function CardPriorityPicker({
  value,
  onChange,
  disabled,
}: {
  value: CardPriorityValue | null;
  onChange: (priority: CardPriorityValue | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  function pick(next: CardPriorityValue | null) {
    setOpen(false);
    if (next !== value) onChange(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          {value ? (
            <span
              className={cn("mr-2 size-2 rounded-full", PRIORITY_DOT_CLASSES[value])}
              aria-hidden
            />
          ) : (
            <Flag className="mr-2 size-4" />
          )}
          {value ? PRIORITY_LABELS[value] : "Priorita"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        {CARD_PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => pick(p)}
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] transition-colors duration-150 hover:bg-muted motion-reduce:transition-none",
              value === p && "bg-muted",
            )}
          >
            <span className={cn("size-2 rounded-full", PRIORITY_DOT_CLASSES[p])} aria-hidden />
            <span className="flex-1">{PRIORITY_LABELS[p]}</span>
            {value === p ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
          </button>
        ))}
        <button
          type="button"
          onClick={() => pick(null)}
          className={cn(
            "mt-1 flex w-full items-center gap-2 rounded border-t px-2 py-1.5 pt-2 text-left text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-muted motion-reduce:transition-none",
            value === null && "bg-muted",
          )}
        >
          <span className="flex-1">Bez priority</span>
          {value === null ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
        </button>
      </PopoverContent>
    </Popover>
  );
}
