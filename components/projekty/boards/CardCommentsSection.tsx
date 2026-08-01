"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/projekty/ui/button";
import { ConfirmDialog } from "@/components/projekty/ui/confirm-dialog";
import { EmptyState } from "@/components/projekty/ui/empty-state";
import { Textarea } from "@/components/projekty/ui/textarea";
import { UserAvatar } from "@/components/projekty/UserAvatar";
import { MessageSquare, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { toast } from "sonner";

type UserLite = { id: number; email: string | null; name: string | null; image: string | null };

type Note = {
  id: string;
  parentType: "CARD";
  parentId: string;
  content: string;
  authorId: number | null;
  author: UserLite | null;
  createdAt: string;
};

export function CardCommentsSection({
  cardId,
  currentUserId,
}: {
  cardId: string;
  currentUserId: number;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/projekty/notes?parentType=CARD&parentId=${cardId}`)
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("fetch failed")),
      )
      .then((data: { notes: Note[] }) => setNotes(data.notes))
      .catch(() => toast.error("Načtení komentářů selhalo."))
      .finally(() => setLoaded(true));
  }, [cardId]);

  async function handlePost() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await fetch("/api/projekty/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          parentType: "CARD",
          parentId: cardId,
          content: trimmed,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Odeslání selhalo.");
        return;
      }
      const { note } = (await res.json()) as { note: Note };
      setNotes((prev) => [note, ...prev]);
      setDraft("");
    } catch {
      toast.error("Odeslání selhalo (chyba sítě).");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/projekty/notes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Smazání selhalo.");
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-foreground">
        <MessageSquare className="size-4" /> Komentáře ({notes.length})
      </h3>

      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Napiš komentář…"
          disabled={busy}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => void handlePost()}
            disabled={busy || !draft.trim()}
          >
            {busy ? "Odesílám…" : "Odeslat"}
          </Button>
        </div>
      </div>

      {loaded && notes.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Zatím žádné komentáře"
          description="Napiš první — @zmínkou pošleš upozornění."
          className="py-6"
        />
      ) : null}
      <ul className="space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="flex gap-2">
            {n.author ? <UserAvatar user={n.author} className="mt-0.5 size-7" /> : null}
            <div className="flex-1 rounded bg-muted/40 p-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {n.author?.name ?? n.author?.email ?? "—"}
                </span>
                <span>
                  {format(new Date(n.createdAt), "d. M. yyyy HH:mm", { locale: cs })}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{n.content}</p>
              {n.authorId === currentUserId ? (
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" /> Smazat
                    </button>
                  }
                  title="Smazat komentář?"
                  destructive
                  confirmLabel="Smazat"
                  onConfirm={() => handleDelete(n.id)}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
