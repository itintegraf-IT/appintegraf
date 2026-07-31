"use client";

import { useState } from "react";
import { Checkbox } from "@/components/projekty/ui/checkbox";
import { Button } from "@/components/projekty/ui/button";
import { ConfirmDialog } from "@/components/projekty/ui/confirm-dialog";
import { Input } from "@/components/projekty/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/projekty/ui/popover";
import { Calendar as CalendarPicker } from "@/components/projekty/ui/calendar";
import { UserAvatar } from "@/components/projekty/UserAvatar";
import { Trash2, User as UserIcon, Calendar, X, Check } from "lucide-react";
import { DueDateBadge } from "@/components/projekty/DueDateBadge";
import { cs } from "date-fns/locale";
import { toast } from "sonner";

type UserLite = { id: number; email: string | null; name: string | null; image: string | null };

export type ChecklistItem = {
  id: string;
  checklistId: string;
  text: string;
  done: boolean;
  position: number;
  assigneeId: number | null;
  dueDate: string | null;
};

export function ChecklistItemRow({
  item,
  boardMembers,
  onUpdate,
  onDelete,
}: {
  item: ChecklistItem;
  boardMembers: UserLite[];
  onUpdate: (item: ChecklistItem) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const [busy, setBusy] = useState(false);

  async function patch(payload: Record<string, unknown>) {
    const res = await fetch(`/api/projekty/checklist-items/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      toast.error("Uložení selhalo.");
      return null;
    }
    const { item: updated } = (await res.json()) as { item: ChecklistItem };
    onUpdate(updated);
    return updated;
  }

  async function handleToggle(done: boolean) {
    setBusy(true);
    await patch({ done });
    setBusy(false);
  }

  async function handleTextSave() {
    if (text.trim() === item.text || !text.trim()) {
      setText(item.text);
      setEditing(false);
      return;
    }
    setBusy(true);
    await patch({ text: text.trim() });
    setBusy(false);
    setEditing(false);
  }

  async function handleDelete() {
    setBusy(true);
    const res = await fetch(`/api/projekty/checklist-items/${item.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      toast.error("Smazání selhalo.");
      return;
    }
    onDelete();
  }

  const assignee = item.assigneeId
    ? boardMembers.find((u) => u.id === item.assigneeId) ?? null
    : null;
  const due = item.dueDate ? new Date(item.dueDate) : null;

  return (
    <div className="group flex items-start gap-2 rounded px-1 py-1 hover:bg-muted/40">
      <Checkbox
        checked={item.done}
        disabled={busy}
        onCheckedChange={(v) => void handleToggle(Boolean(v))}
        className="mt-0.5"
      />
      <div className="flex flex-1 flex-col gap-1">
        {editing ? (
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => void handleTextSave()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleTextSave();
              if (e.key === "Escape") {
                setText(item.text);
                setEditing(false);
              }
            }}
            autoFocus
            className="h-7 text-sm"
            disabled={busy}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className={`text-left text-sm ${item.done ? "text-muted-foreground line-through" : ""}`}
          >
            {item.text}
          </button>
        )}

        {(assignee || due) ? (
          <div className="flex items-center gap-2 text-xs">
            {assignee ? (
              <button
                onClick={() => void patch({ assigneeId: null })}
                className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 hover:bg-muted/60"
                title="Odebrat assignee"
              >
                <UserAvatar user={assignee} className="size-4" />
                <span className="truncate">{assignee.name ?? assignee.email ?? "—"}</span>
                <X className="size-3" />
              </button>
            ) : null}
            {due ? (
              <button
                onClick={() => void patch({ dueDate: null })}
                className="flex items-center gap-1 hover:opacity-80"
                title="Odebrat termín"
              >
                <DueDateBadge due={due} completed={item.done} variant="withYear" />
                <X className="size-3 text-muted-foreground" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="size-6" disabled={busy}>
              <UserIcon className="size-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="end">
            {boardMembers.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">Žádní členové.</p>
            ) : (
              boardMembers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => void patch({ assigneeId: u.id })}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted/60"
                >
                  <UserAvatar user={u} className="size-5" />
                  <span className="flex-1">{u.name ?? u.email ?? "—"}</span>
                  {item.assigneeId === u.id ? <Check className="size-3 text-primary" /> : null}
                </button>
              ))
            )}
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="size-6" disabled={busy}>
              <Calendar className="size-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarPicker
              mode="single"
              selected={due ?? undefined}
              onSelect={(date) =>
                void patch({ dueDate: date ? date.toISOString() : null })
              }
              locale={cs}
            />
          </PopoverContent>
        </Popover>
        <ConfirmDialog
          trigger={
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              disabled={busy}
              aria-label="Smazat položku"
            >
              <Trash2 className="size-3" />
            </Button>
          }
          title={`Smazat „${item.text}"?`}
          destructive
          confirmLabel="Smazat"
          onConfirm={handleDelete}
        />
      </div>
    </div>
  );
}
