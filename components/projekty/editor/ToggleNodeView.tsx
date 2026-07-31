"use client";

import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { ChevronRight } from "lucide-react";

export function ToggleNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const open = Boolean(node.attrs.open);
  return (
    <NodeViewWrapper
      className="my-2 rounded-md border border-border bg-muted/30 px-2 py-1.5"
      data-type="toggle"
      data-open={open ? "true" : "false"}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          onClick={() => updateAttributes({ open: !open })}
          aria-label={open ? "Sbalit" : "Rozbalit"}
          title={open ? "Sbalit obsah" : "Rozbalit obsah"}
          className="mt-0.5 grid size-6 shrink-0 cursor-pointer place-items-center rounded text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          contentEditable={false}
        >
          <ChevronRight
            className={`size-4 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
            strokeWidth={2.5}
          />
        </button>
        <div className="min-w-0 flex-1">
          <NodeViewContent />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
