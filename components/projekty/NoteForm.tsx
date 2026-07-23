"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/projekty/ui/button";
import { Textarea } from "@/components/projekty/ui/textarea";
import type { ParentType } from "@prisma/client";

export function NoteForm({ parentType, parentId }: { parentType: ParentType; parentId: string }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/projekty/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentType, parentId, content }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Chyba");
      }
      setContent("");
      router.refresh();
      toast.success("Poznámka uložena");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-lg border bg-card p-4">
      <Textarea
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Napiš poznámku… (zmíň kolegu přes @jmeno@integraf.cz)"
      />
      <Button type="submit" disabled={submitting || !content.trim()}>
        {submitting ? "Ukládám…" : "Přidat poznámku"}
      </Button>
    </form>
  );
}
