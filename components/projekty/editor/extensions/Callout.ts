import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CalloutNodeView } from "../CalloutNodeView";

export type CalloutColor = "default" | "info" | "warning" | "success" | "danger" | "note";

export const CALLOUT_COLORS: CalloutColor[] = [
  "default",
  "info",
  "warning",
  "success",
  "danger",
  "note",
];

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      emoji: {
        default: "💡",
        parseHTML: (el) => el.getAttribute("data-emoji") ?? "💡",
        renderHTML: (attrs: Record<string, unknown>) => ({ "data-emoji": attrs.emoji }),
      },
      color: {
        default: "default" as CalloutColor,
        parseHTML: (el) => (el.getAttribute("data-color") as CalloutColor) ?? "default",
        renderHTML: (attrs: Record<string, unknown>) => ({ "data-color": attrs.color }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },
});
