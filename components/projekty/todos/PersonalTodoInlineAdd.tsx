"use client";

import { useState, useRef } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export function PersonalTodoInlineAdd({ onCreated }: { onCreated: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const title = value.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/projekty/personal-todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("API error");
      setValue("");
      onCreated();
      inputRef.current?.focus();
    } catch {
      toast.error("Úkol se nepodařilo přidat");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="group flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-[hsl(var(--notion-fg)/0.02)]">
      <Plus className="size-4 shrink-0 text-[hsl(var(--notion-fg)/0.4)] transition-colors group-focus-within:text-[hsl(var(--notion-fg))]" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit();
          } else if (e.key === "Escape") {
            setValue("");
          }
        }}
        disabled={busy}
        placeholder="Nový úkol… (Enter pro uložení)"
        className="flex-1 bg-transparent text-[hsl(var(--notion-fg))] placeholder:text-[hsl(var(--notion-fg)/0.4)] focus:outline-none"
      />
    </div>
  );
}
