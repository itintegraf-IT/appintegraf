"use client";

import { useState } from "react";
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { EmojiPicker } from "./EmojiPicker";
import { CALLOUT_COLORS, type CalloutColor } from "./extensions/Callout";

const COLOR_CLASS: Record<CalloutColor, string> = {
  default: "bg-muted/50 border-border",
  info: "bg-blue-500/10 border-blue-500/40",
  warning: "bg-(--warning)/10 border-(--warning)/40",
  success: "bg-(--success)/10 border-(--success)/40",
  danger: "bg-(--destructive)/10 border-(--destructive)/40",
  note: "bg-background border-border",
};

const COLOR_SWATCH: Record<CalloutColor, string> = {
  default: "var(--muted-foreground)",
  info: "var(--color-blue-500)",
  warning: "var(--warning)",
  success: "var(--success)",
  danger: "var(--destructive)",
  note: "var(--muted-foreground)",
};

export function CalloutNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const emoji = (node.attrs.emoji as string) ?? "💡";
  const color = (node.attrs.color as CalloutColor) ?? "default";

  return (
    <NodeViewWrapper
      className={`my-2 flex items-start gap-2 rounded-lg border p-3 ${COLOR_CLASS[color]}`}
      data-type="callout"
      data-emoji={emoji}
      data-color={color}
    >
      <div className="relative flex shrink-0 flex-col gap-1">
        <button
          type="button"
          onClick={() => {
            setEmojiOpen((o) => !o);
            setColorOpen(false);
          }}
          aria-label="Změnit emoji"
          className="grid size-7 place-items-center rounded text-lg hover:bg-muted/50"
          contentEditable={false}
        >
          {emoji}
        </button>
        <button
          type="button"
          onClick={() => {
            setColorOpen((o) => !o);
            setEmojiOpen(false);
          }}
          aria-label="Změnit barvu"
          className="size-3 rounded-full ring-1 ring-border"
          style={{ backgroundColor: COLOR_SWATCH[color] }}
          contentEditable={false}
        />
        {emojiOpen ? (
          <div className="absolute left-9 top-0 z-10" contentEditable={false}>
            <EmojiPicker
              current={emoji}
              onSelect={(e) => updateAttributes({ emoji: e })}
              onClose={() => setEmojiOpen(false)}
            />
          </div>
        ) : null}
        {colorOpen ? (
          <div
            className="absolute left-9 top-0 z-10 flex flex-col gap-1 rounded-lg border border-border bg-popover p-2 shadow-lg"
            contentEditable={false}
          >
            {CALLOUT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  updateAttributes({ color: c });
                  setColorOpen(false);
                }}
                aria-label={`Barva ${c}`}
                className={`flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors hover:bg-accent ${
                  c === color ? "ring-1 ring-ring" : ""
                }`}
              >
                <span
                  className="size-3 rounded-full ring-1 ring-border"
                  style={{ backgroundColor: COLOR_SWATCH[c] }}
                />
                <span>{c}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <NodeViewContent className="flex-1" />
    </NodeViewWrapper>
  );
}
