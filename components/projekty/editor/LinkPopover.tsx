"use client";

import { useState } from "react";
import { Link as LinkIcon, Check, X } from "lucide-react";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/projekty/ui/button";
import { Input } from "@/components/projekty/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/projekty/ui/popover";

export function LinkPopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  function openPopover() {
    const existing = (editor.getAttributes("link").href as string | undefined) ?? "";
    setUrl(existing);
    setOpen(true);
  }

  function apply() {
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setOpen(false);
  }

  function clear() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setUrl("");
    setOpen(false);
  }

  const isActive = editor.isActive("link");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant={isActive ? "default" : "ghost"}
          className="size-9 sm:size-7"
          onClick={openPopover}
          aria-label="Odkaz"
        >
          <LinkIcon className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
          className="flex items-center gap-1"
        >
          <Input
            type="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
            className="h-9 text-sm"
          />
          <Button type="submit" size="icon" className="size-9 shrink-0" aria-label="Uložit odkaz">
            <Check className="size-4" />
          </Button>
          {isActive ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-9 shrink-0"
              onClick={clear}
              aria-label="Odstranit odkaz"
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </form>
      </PopoverContent>
    </Popover>
  );
}
