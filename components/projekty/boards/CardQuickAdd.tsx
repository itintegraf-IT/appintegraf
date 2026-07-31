"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CardData } from "./CardItem";

type Props = {
  listId: string;
  onCreated?: (card: CardData) => void;
  /** Controlled open state. If omitted, component manages its own state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function CardQuickAdd({ listId, onCreated, open: controlledOpen, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const active = controlledOpen ?? internalOpen;
  const setActive = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when externally opened
  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  function reset() {
    setTitle("");
    setActive(false);
  }

  async function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) {
      reset();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/projekty/lists/${listId}/cards`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Vytvoření karty selhalo.");
        return;
      }
      const { card } = (await res.json()) as { card: Omit<CardData, "members" | "labels"> };
      // API vrací jen base card; doplníme prázdné members/labels pro typecheck
      onCreated?.({
        ...card,
        members: [],
        labels: [],
      });
      setTitle("");
      inputRef.current?.focus();
    } catch {
      toast.error("Vytvoření karty selhalo (chyba sítě).");
    } finally {
      setBusy(false);
    }
  }

  if (!active) return null;

  return (
    <div
      className="mt-2 rounded-lg border border-border bg-card p-2 shadow-sm"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <textarea
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleCreate();
          }
          if (e.key === "Escape") reset();
        }}
        placeholder="Název karty… (Enter pro přidání, Esc pro zrušení)"
        rows={2}
        disabled={busy}
        className="w-full resize-none border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
      />
      <div className="mt-1.5 flex items-center justify-end gap-1.5">
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
          disabled={busy || !title.trim()}
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Přidávám…" : "Přidat"}
        </button>
      </div>
    </div>
  );
}
