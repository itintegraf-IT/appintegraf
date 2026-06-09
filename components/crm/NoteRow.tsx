"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { toast } from "sonner";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/crm/DeleteConfirmDialog";
import { UserAvatar } from "@/components/crm/UserAvatar";
import { renderMentions, type MentionUser } from "@/lib/crm/mentions";
import { crmUserDisplayName } from "@/lib/crm/users";

type NoteAuthor = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
} | null;

export type EditableNote = {
  id: string;
  content: string;
  created_at: Date | string;
  author: NoteAuthor;
};

type Props = {
  note: EditableNote;
  users: MentionUser[];
  canEdit: boolean;
};

export function NoteRow({ note, users, canEdit }: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [submitting, setSubmitting] = useState(false);

  const d = typeof note.created_at === "string" ? new Date(note.created_at) : note.created_at;

  async function save() {
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error("Obsah poznámky nesmí být prázdný.");
      return;
    }
    if (trimmed === note.content) {
      setIsEditing(false);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Nepodařilo se uložit poznámku.");
      }
      toast.success("Poznámka uložena");
      setIsEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove() {
    const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(j.error ?? "Nepodařilo se smazat poznámku.");
      throw new Error(j.error ?? "delete failed");
    }
    toast.success("Poznámka smazána");
    router.refresh();
  }

  function cancel() {
    setContent(note.content);
    setIsEditing(false);
  }

  return (
    <li className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex min-w-0 items-center gap-1.5 font-medium">
          {note.author ? (
            <UserAvatar user={note.author} size="xs" />
          ) : (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[9px] text-muted-foreground">
              ?
            </span>
          )}
          <span className="truncate">{note.author ? crmUserDisplayName(note.author) : "(smazaný uživatel)"}</span>
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <time className="text-muted-foreground">{format(d, "d. M. yyyy HH:mm", { locale: cs })}</time>
          {canEdit && !isEditing ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                aria-label="Upravit poznámku"
                title="Upravit"
              >
                <Pencil className="size-3.5" />
              </Button>
              <DeleteConfirmDialog
                title="Smazat poznámku?"
                description="Tato akce je nevratná. Poznámka bude smazána ze záznamu."
                onConfirm={remove}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Smazat poznámku"
                    title="Smazat"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                }
              />
            </>
          ) : null}
        </div>
      </div>

      {isEditing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            rows={Math.min(8, Math.max(3, content.split("\n").length + 1))}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={submitting}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={cancel} disabled={submitting}>
              <X className="mr-1 size-3.5" />
              Zrušit
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={submitting}>
              <Check className="mr-1 size-3.5" />
              {submitting ? "Ukládám…" : "Uložit"}
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="mt-2 whitespace-pre-wrap break-words text-sm [&_.mention]:rounded [&_.mention]:bg-blue-100 [&_.mention]:px-1 [&_.mention]:text-blue-900 dark:[&_.mention]:bg-blue-900/40 dark:[&_.mention]:text-blue-200"
          dangerouslySetInnerHTML={{ __html: renderMentions(note.content, users) }}
        />
      )}

    </li>
  );
}
