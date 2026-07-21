"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/projekty/ui/button";
import { Input } from "@/components/projekty/ui/input";
import { Label } from "@/components/projekty/ui/label";
import { Textarea } from "@/components/projekty/ui/textarea";
import { toast } from "sonner";

const PRESET_COLORS = [
  "#0079bf", "#d29034", "#519839", "#b04632",
  "#89609e", "#cd5a91", "#4bbf6b", "#00aecc",
] as const;

type Board = {
  id: string;
  name: string;
  description: string | null;
  background: string | null;
};

export function BoardSettingsForm({ board }: { board: Board }) {
  const router = useRouter();
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description ?? "");
  const [background, setBackground] = useState<string>(board.background ?? PRESET_COLORS[0]);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projekty/boards/${board.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          background,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Uložení selhalo.");
        return;
      }
      toast.success("Uloženo.");
      router.refresh();
    } catch {
      toast.error("Uložení selhalo (chyba sítě).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded border p-4 space-y-4">
      <h2 className="text-lg font-semibold">Obecné</h2>
      <div className="space-y-1.5">
        <Label htmlFor="b-name">Název</Label>
        <Input
          id="b-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="b-desc">Popis</Label>
        <Textarea
          id="b-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
        />
      </div>
      <div className="space-y-2">
        <Label>Barva pozadí</Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Barva ${c}`}
              onClick={() => setBackground(c)}
              className={`size-11 rounded transition-all sm:size-8 ${background === c ? "ring-2 ring-foreground ring-offset-2" : ""}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={() => void handleSave()}
          disabled={busy || !name.trim()}
          className="min-h-11 w-full sm:w-auto"
        >
          {busy ? "Ukládám…" : "Uložit"}
        </Button>
      </div>
    </section>
  );
}
