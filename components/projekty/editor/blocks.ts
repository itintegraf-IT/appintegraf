import type { Editor } from "@tiptap/core";
import {
  AlertCircle,
  CheckSquare,
  ChevronRight,
  Code,
  Image as ImageIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  type LucideIcon,
} from "lucide-react";

export type BlockCategory = "headings" | "basic" | "callout" | "media";

export type Block = {
  name: string;
  /** Aliasy pro filtraci (např. "info" matchuje Callout). */
  keywords?: string[];
  category: BlockCategory;
  /** Buď text label (např. "H1") nebo lucide icon component. */
  icon: string | LucideIcon;
  /** Spustí se při výběru z menu. */
  command: (editor: Editor) => void;
};

export const BLOCKS: Block[] = [
  // Headings
  {
    name: "Nadpis 1",
    category: "headings",
    icon: "H1",
    command: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    name: "Nadpis 2",
    category: "headings",
    icon: "H2",
    command: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    name: "Nadpis 3",
    category: "headings",
    icon: "H3",
    command: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },

  // Basic blocks
  {
    name: "Odrážky",
    category: "basic",
    icon: List,
    command: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    name: "Číslovaný seznam",
    category: "basic",
    icon: ListOrdered,
    command: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    name: "Úkolový seznam",
    category: "basic",
    icon: CheckSquare,
    keywords: ["task", "todo"],
    command: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    name: "Citace",
    category: "basic",
    icon: Quote,
    keywords: ["quote", "blockquote"],
    command: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    name: "Code block",
    category: "basic",
    icon: Code,
    keywords: ["kód", "snippet"],
    command: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    name: "Oddělovač",
    category: "basic",
    icon: Minus,
    keywords: ["divider", "hr", "horizontal"],
    command: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    name: "Toggle",
    category: "basic",
    icon: ChevronRight,
    keywords: ["collapse", "rozbalit"],
    command: (e) =>
      e
        .chain()
        .focus()
        .insertContent({
          type: "toggle",
          attrs: { open: false },
          content: [
            // ToggleSummary má content: "inline*" → prázdný obsah je validní.
            // Empty text node `{ type: "text", text: "" }` ProseMirror schema
            // ODMÍTÁ (silent fail celé transakce → Toggle se nevloží).
            { type: "toggleSummary" },
            { type: "toggleBody", content: [{ type: "paragraph" }] },
          ],
        })
        .run(),
  },

  // Callout
  {
    name: "Callout",
    category: "callout",
    icon: AlertCircle,
    keywords: ["info", "varování", "úspěch", "poznámka"],
    command: (e) =>
      e
        .chain()
        .focus()
        .insertContent({
          type: "callout",
          attrs: { emoji: "💡", color: "default" },
          content: [{ type: "paragraph" }],
        })
        .run(),
  },

  // Media
  {
    name: "Obrázek",
    category: "media",
    icon: ImageIcon,
    keywords: ["image", "foto", "picture"],
    command: (e) => {
      // Otevře file picker — implementace v ImageUpload extension (Task 7).
      // Tady jen dispatch custom event, který file picker chytí.
      const event = new CustomEvent("tiptap:open-image-picker");
      window.dispatchEvent(event);
      e.chain().focus().run();
    },
  },
];

/**
 * Filter blocks by query (matches `name` and `keywords` case-insensitive).
 * Optional `exclude` skipuje bloky podle `name` (např. ["Obrázek"] když není
 * dostupný file upload kontext).
 */
export function filterBlocks(query: string, options?: { exclude?: string[] }): Block[] {
  const exclude = options?.exclude ?? [];
  const available = exclude.length === 0 ? BLOCKS : BLOCKS.filter((b) => !exclude.includes(b.name));
  if (!query) return available;
  const q = query.toLowerCase();
  return available.filter((b) => {
    if (b.name.toLowerCase().includes(q)) return true;
    if (b.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
    return false;
  });
}
