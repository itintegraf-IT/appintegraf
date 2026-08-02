"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { Editor } from "@tiptap/core";
import { type Block } from "./blocks";
import { BLOCK_PREVIEWS } from "./block-previews";

const CATEGORY_LABELS: Record<string, string> = {
  headings: "Nadpisy",
  basic: "Základní bloky",
  callout: "Callout",
  media: "Média",
};

const CATEGORY_ORDER: Block["category"][] = ["headings", "basic", "callout", "media"];

export type SlashMenuPopoverProps = {
  items: Block[];
  command: (block: Block) => void;
  editor: Editor;
};

export type SlashMenuPopoverRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

export const SlashMenuPopover = forwardRef<SlashMenuPopoverRef, SlashMenuPopoverProps>(
  function SlashMenuPopover({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          const item = items[selectedIndex];
          if (item) command(item);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-border bg-popover p-4 text-sm text-muted-foreground shadow-lg">
          Žádné bloky nenalezeny.
        </div>
      );
    }

    // Group items by category, preserving CATEGORY_ORDER
    const grouped = CATEGORY_ORDER.map((cat) => ({
      cat,
      items: items.filter((i) => i.category === cat),
    })).filter((g) => g.items.length > 0);

    let runningIndex = 0;
    const selectedItem = items[selectedIndex];
    const preview = selectedItem ? BLOCK_PREVIEWS[selectedItem.name] : undefined;

    return (
      <div className="flex items-start gap-1.5">
        <div className="max-h-[320px] w-72 overflow-y-auto rounded-lg border border-border bg-popover py-2 shadow-lg">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Bloky · /
          </div>
          {grouped.map((group) => (
            <div key={group.cat}>
              <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {CATEGORY_LABELS[group.cat]}
              </div>
              {group.items.map((item) => {
                const idx = runningIndex++;
                const active = idx === selectedIndex;
                const Icon = typeof item.icon === "string" ? null : item.icon;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      command(item);
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                      active ? "bg-accent" : ""
                    }`}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded border border-border bg-background text-[11px] font-bold">
                      {typeof item.icon === "string" ? (
                        item.icon
                      ) : Icon ? (
                        <Icon className="size-3.5" strokeWidth={1.75} />
                      ) : null}
                    </span>
                    <span className="text-foreground">{item.name}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Preview panel — Notion-style. Skrývá se pokud blok nemá preview definovaný. */}
        {preview ? (
          <div className="hidden w-56 shrink-0 rounded-lg bg-foreground p-2 shadow-lg sm:block">
            <div className="grid min-h-[120px] place-items-center rounded bg-background p-3">{preview.mock}</div>
            <div className="px-1 pt-2 text-xs text-background/80">{preview.caption}</div>
          </div>
        ) : null}
      </div>
    );
  },
);
