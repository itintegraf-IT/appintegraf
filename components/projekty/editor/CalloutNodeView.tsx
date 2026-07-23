"use client";

import { useState } from "react";
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { EmojiPicker } from "./EmojiPicker";
import { CALLOUT_COLORS, type CalloutColor } from "./extensions/Callout";

const COLOR_CLASS: Record<CalloutColor, string> = {
  default: "bg-[hsl(var(--notion-fg)/0.04)] border-[hsl(var(--notion-fg)/0.12)]",
  info: "bg-[hsl(var(--info)/0.10)] border-[hsl(var(--info)/0.40)]",
  warning: "bg-[hsl(var(--warning)/0.10)] border-[hsl(var(--warning)/0.40)]",
  success: "bg-[hsl(var(--success)/0.10)] border-[hsl(var(--success)/0.40)]",
  danger: "bg-[hsl(var(--destructive)/0.10)] border-[hsl(var(--destructive)/0.40)]",
  note: "bg-[hsl(var(--notion-canvas))] border-[hsl(var(--notion-fg)/0.12)]",
};

const COLOR_SWATCH: Record<CalloutColor, string> = {
  default: "hsl(var(--notion-fg) / 0.4)",
  info: "hsl(var(--info))",
  warning: "hsl(var(--warning))",
  success: "hsl(var(--success))",
  danger: "hsl(var(--destructive))",
  note: "hsl(var(--notion-fg) / 0.6)",
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
          className="grid size-7 place-items-center rounded text-lg hover:bg-[hsl(var(--notion-fg)/0.06)]"
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
          className="size-3 rounded-full ring-1 ring-[hsl(var(--notion-fg)/0.2)]"
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
            className="absolute left-9 top-0 z-10 flex flex-col gap-1 rounded-lg border border-[hsl(var(--notion-fg)/0.12)] bg-[hsl(var(--notion-canvas))] p-2 shadow-lg"
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
                className={`flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors hover:bg-[hsl(var(--notion-fg)/0.06)] ${
                  c === color ? "ring-1 ring-[hsl(var(--notion-fg)/0.4)]" : ""
                }`}
              >
                <span
                  className="size-3 rounded-full ring-1 ring-[hsl(var(--notion-fg)/0.2)]"
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
