"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Button } from "@/components/projekty/ui/button";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Plus,
} from "lucide-react";
import { LinkPopover } from "./LinkPopover";
import { SlashCommand } from "./extensions/SlashCommand";
import { Callout } from "./extensions/Callout";
import { Toggle, ToggleSummary, ToggleBody } from "./extensions/Toggle";
import { ImageUpload, uploadAndInsert } from "./extensions/ImageUpload";
import { useEffect, useRef } from "react";

export type TiptapEditorVariant = "rich" | "simple";

export function TiptapEditor({
  value,
  onChange,
  placeholder = "",
  className = "",
  variant = "simple",
  cardId,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  variant?: TiptapEditorVariant;
  cardId?: string;
}) {
  // variant=rich bez cardId = osobní todo (žádný image upload, žádný attachments parent).
  // Slash menu vynechá "Obrázek" v takovém kontextu.
  const richWithImages = variant === "rich" && Boolean(cardId);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (variant !== "rich" || !cardId) return;
    function handleOpenPicker() {
      fileInputRef.current?.click();
    }
    window.addEventListener("tiptap:open-image-picker", handleOpenPicker);
    return () => window.removeEventListener("tiptap:open-image-picker", handleOpenPicker);
  }, [variant, cardId]);

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor || !cardId) return;
    await uploadAndInsert(editor.view, file, cardId);
    e.target.value = "";
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
      // Rich features (slash menu, callout, toggle, task list) běží i bez cardId
      ...(variant === "rich"
        ? [
            SlashCommand.configure({
              excludeBlocks: richWithImages ? [] : ["Obrázek"],
            }),
            Callout,
            Toggle,
            ToggleSummary,
            ToggleBody,
            TaskList,
            TaskItem.configure({ nested: true }),
          ]
        : []),
      // Image upload je gated na cardId (potřebuje attachments parent)
      ...(richWithImages ? [Image, ImageUpload.configure({ cardId: cardId! })] : []),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  if (!editor) return null;

  return (
    <div className={`rounded border bg-background ${className}`}>
      <div className="flex items-center gap-1 overflow-x-auto border-b px-2 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {variant === "rich" ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 gap-1 px-2 sm:h-7"
              onClick={() => editor.chain().focus().insertContent("/").run()}
              aria-label="Vložit blok"
              title="Vložit blok (nebo napiš /)"
            >
              <Plus className="size-3.5" />
              Blok
            </Button>
            <span className="mx-1 h-5 w-px bg-[hsl(var(--notion-fg)/0.12)]" aria-hidden />
            <Button
              type="button"
              size="icon"
              variant={editor.isActive("heading", { level: 1 }) ? "default" : "ghost"}
              className="size-9 sm:size-7"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              aria-label="Nadpis 1"
            >
              <Heading1 className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={editor.isActive("heading", { level: 2 }) ? "default" : "ghost"}
              className="size-9 sm:size-7"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              aria-label="Nadpis 2"
            >
              <Heading2 className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={editor.isActive("heading", { level: 3 }) ? "default" : "ghost"}
              className="size-9 sm:size-7"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              aria-label="Nadpis 3"
            >
              <Heading3 className="size-3.5" />
            </Button>
            <span className="mx-1 h-5 w-px bg-[hsl(var(--notion-fg)/0.12)]" aria-hidden />
          </>
        ) : null}
        <Button
          type="button"
          size="icon"
          variant={editor.isActive("bold") ? "default" : "ghost"}
          className="size-9 sm:size-7"
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Tučně"
        >
          <Bold className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={editor.isActive("italic") ? "default" : "ghost"}
          className="size-9 sm:size-7"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Kurzíva"
        >
          <Italic className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={editor.isActive("bulletList") ? "default" : "ghost"}
          className="size-9 sm:size-7"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Odrážky"
        >
          <List className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={editor.isActive("orderedList") ? "default" : "ghost"}
          className="size-9 sm:size-7"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Číslovaný seznam"
        >
          <ListOrdered className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={editor.isActive("code") ? "default" : "ghost"}
          className="size-9 sm:size-7"
          onClick={() => editor.chain().focus().toggleCode().run()}
          aria-label="Inline kód"
        >
          <Code className="size-3.5" />
        </Button>
        <LinkPopover editor={editor} />
      </div>
      {variant === "rich" ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFilePick}
        />
      ) : null}
      <EditorContent
        editor={editor}
        className="min-h-24 p-3 text-sm focus:outline-none [&_*:focus]:outline-none [&_p]:my-1 [&_h1]:my-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:my-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h3]:my-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_ul]:ml-4 [&_ul]:list-disc [&_ol]:ml-4 [&_ol]:list-decimal [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-[hsl(var(--notion-fg)/0.2)] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-[hsl(var(--notion-fg)/0.7)] [&_pre]:my-2 [&_pre]:rounded [&_pre]:bg-[hsl(var(--notion-fg)/0.06)] [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-xs [&_hr]:my-3 [&_hr]:border-[hsl(var(--notion-fg)/0.12)] [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_img]:max-w-full [&_img]:rounded"
      />
    </div>
  );
}
