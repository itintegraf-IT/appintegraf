"use client";

import { useState } from "react";
import { Button } from "@/components/projekty/ui/button";
import { ConfirmDialog } from "@/components/projekty/ui/confirm-dialog";
import { Input } from "@/components/projekty/ui/input";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

const PRESET_COLORS = [
  "#e60000", "#ff9900", "#ffcc00", "#33cc33",
  "#0079bf", "#7c3aed", "#cd5a91", "#475569",
] as const;

type Label = { id: string; boardId: string; name: string; color: string };

export function BoardLabelsManager({
  boardId,
  labels: initialLabels,
}: { boardId: string; labels: Label[] }) {
  const [labels, setLabels] = useState(initialLabels);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projekty/boards/${boardId}/labels`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed, color }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Vytvoření selhalo.");
        return;
      }
      const { label } = (await res.json()) as { label: Label };
      setLabels((prev) => [...prev, label].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setColor(PRESET_COLORS[0]);
      setAdding(false);
    } catch {
      toast.error("Vytvoření selhalo (chyba sítě).");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(labelId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projekty/labels/${labelId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Smazání selhalo.");
        return;
      }
      setLabels((prev) => prev.filter((l) => l.id !== labelId));
    } catch {
      toast.error("Smazání selhalo (chyba sítě).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Labely</h2>
        {!adding ? (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1 size-4" />
            Přidat label
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="space-y-2 rounded border p-3">
          <Input
            placeholder="Název…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Barva ${c}`}
                onClick={() => setColor(c)}
                className={`size-7 rounded transition-all ${color === c ? "ring-2 ring-foreground ring-offset-1" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => { setAdding(false); setName(""); }}>
              Zrušit
            </Button>
            <Button size="sm" onClick={() => void handleAdd()} disabled={busy || !name.trim()}>
              {busy ? "Přidávám…" : "Přidat"}
            </Button>
          </div>
        </div>
      ) : null}

      {labels.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Zatím žádné labely.</p>
      ) : (
        <ul className="space-y-1">
          {labels.map((l) => (
            <li key={l.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
              <span className="size-4 shrink-0 rounded" style={{ backgroundColor: l.color }} />
              <span className="flex-1 text-sm">{l.name}</span>
              <ConfirmDialog
                trigger={
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={busy}
                    aria-label="Smazat label"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                }
                title={`Smazat label „${l.name}"?`}
                destructive
                confirmLabel="Smazat"
                onConfirm={() => handleDelete(l.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
