"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ResponsiveDialog } from "@/components/projekty/ui/responsive-dialog";
import { Button } from "@/components/projekty/ui/button";
import { Input } from "@/components/projekty/ui/input";
import { Label } from "@/components/projekty/ui/label";
import { Textarea } from "@/components/projekty/ui/textarea";
import { toast } from "sonner";

const PRESET_COLORS = [
  "#0079bf",
  "#d29034",
  "#519839",
  "#b04632",
  "#89609e",
  "#cd5a91",
  "#4bbf6b",
  "#00aecc",
] as const;

const DEFAULT_BG = PRESET_COLORS[0];

export function BoardCreateDialog({
  open,
  onOpenChange,
}: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [background, setBackground] = useState<string>(DEFAULT_BG);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setDescription("");
    setBackground(DEFAULT_BG);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/projekty/boards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          background,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Vytvoření boardu selhalo.");
        return;
      }
      const { board } = (await res.json()) as { board: { id: string } };
      reset();
      onOpenChange(false);
      // TODO(Task 10): drop `as never` cast once /boards/[boardId] route is registered
      router.push(`/projekty/boards/${board.id}`);
    } catch {
      toast.error("Vytvoření boardu selhalo (chyba sítě).");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Nový board">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="board-name">Název *</Label>
          <Input
            id="board-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            autoFocus
            placeholder="Např. Marketing 2026"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="board-desc">Popis</Label>
          <Textarea
            id="board-desc"
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
                className={`size-8 rounded transition-all ${
                  background === c ? "ring-2 ring-foreground ring-offset-2" : ""
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Zrušit
          </Button>
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? "Vytvářím…" : "Vytvořit"}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
