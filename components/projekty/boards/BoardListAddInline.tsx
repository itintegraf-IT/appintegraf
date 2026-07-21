"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { ListData } from "./BoardListColumn";

type ListWithoutCards = Omit<ListData, "cards">;

type Props = {
  boardId: string;
  onCreated: (list: ListWithoutCards) => void;
};

export function BoardListAddInline({ boardId, onCreated }: Props) {
  const [active, setActive] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setName("");
    setActive(false);
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      reset();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/projekty/boards/${boardId}/lists`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Vytvoření selhalo.");
        return;
      }
      const { list } = (await res.json()) as { list: ListWithoutCards };
      onCreated(list);
      setName("");
      // Keep the form active to allow rapid creation, focus stays on input
      inputRef.current?.focus();
    } catch {
      toast.error("Vytvoření selhalo (chyba sítě).");
    } finally {
      setBusy(false);
    }
  }

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className="flex h-11 w-[260px] shrink-0 snap-start items-center gap-2 rounded-md px-2 text-sm text-[hsl(var(--notion-fg)/0.5)] transition-colors hover:bg-[hsl(var(--notion-fg)/0.06)] hover:text-[hsl(var(--notion-fg))]"
      >
        <Plus className="size-4" /> Nový sloupec
      </button>
    );
  }

  return (
    <div className="flex w-[260px] shrink-0 snap-start flex-col gap-2 rounded-lg bg-[hsl(var(--notion-surface))] p-2 shadow-[var(--shadow-card)]">
      <input
        ref={inputRef}
        className="rounded border-0 bg-transparent px-2 py-1.5 text-sm text-[hsl(var(--notion-fg))] outline-none placeholder:text-[hsl(var(--notion-fg)/0.4)]"
        placeholder="Název sloupce…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleCreate();
          if (e.key === "Escape") reset();
        }}
        autoFocus
        disabled={busy}
      />
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={reset}
          disabled={busy}
          className="rounded-md px-2 py-1 text-xs text-[hsl(var(--notion-fg)/0.6)] hover:bg-[hsl(var(--notion-fg)/0.06)] hover:text-[hsl(var(--notion-fg))]"
        >
          Zrušit
        </button>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={busy || !name.trim()}
          className="rounded-md bg-[hsl(var(--notion-fg))] px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Přidávám…" : "Přidat"}
        </button>
      </div>
    </div>
  );
}
