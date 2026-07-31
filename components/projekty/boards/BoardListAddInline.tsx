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
        className="flex h-11 w-[260px] shrink-0 snap-start items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Plus className="size-4" /> Nový sloupec
      </button>
    );
  }

  return (
    <div className="flex w-[260px] shrink-0 snap-start flex-col gap-2 rounded-lg border border-border bg-card p-2 shadow-sm">
      <input
        ref={inputRef}
        className="rounded border-0 bg-transparent px-2 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
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
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Zrušit
        </button>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={busy || !name.trim()}
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Přidávám…" : "Přidat"}
        </button>
      </div>
    </div>
  );
}
