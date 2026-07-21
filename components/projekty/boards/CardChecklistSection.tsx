"use client";

import { useState } from "react";
import { Button } from "@/components/projekty/ui/button";
import { ConfirmDialog } from "@/components/projekty/ui/confirm-dialog";
import { Input } from "@/components/projekty/ui/input";
import { CheckSquare, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ChecklistItemRow, type ChecklistItem } from "./ChecklistItemRow";

export type Checklist = {
  id: string;
  cardId: string;
  name: string;
  position: number;
  items: ChecklistItem[];
};

type UserLite = { id: number; email: string | null; name: string | null; image: string | null };

export function CardChecklistSection({
  cardId,
  checklists: initial,
  boardMembers,
}: {
  cardId: string;
  checklists: Checklist[];
  boardMembers: UserLite[];
}) {
  const [checklists, setChecklists] = useState<Checklist[]>(initial);
  const [addingTitle, setAddingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  async function handleAddChecklist() {
    const trimmed = newTitle.trim();
    if (!trimmed) {
      setAddingTitle(false);
      setNewTitle("");
      return;
    }
    const res = await fetch(`/api/projekty/cards/${cardId}/checklists`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      toast.error("Vytvoření selhalo.");
      return;
    }
    const { checklist } = (await res.json()) as { checklist: Checklist };
    setChecklists((prev) => [...prev, { ...checklist, items: checklist.items ?? [] }]);
    setNewTitle("");
    setAddingTitle(false);
  }

  async function handleDeleteChecklist(id: string) {
    const res = await fetch(`/api/projekty/checklists/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Smazání selhalo.");
      return;
    }
    setChecklists((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleAddItem(checklistId: string, text: string) {
    const res = await fetch(`/api/projekty/checklists/${checklistId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      toast.error("Přidání položky selhalo.");
      return;
    }
    const { item } = (await res.json()) as { item: ChecklistItem };
    setChecklists((prev) =>
      prev.map((c) => (c.id === checklistId ? { ...c, items: [...c.items, item] } : c)),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-foreground">
          <CheckSquare className="size-4" /> Checklisty
        </h3>
        {!addingTitle ? (
          <Button size="sm" variant="outline" onClick={() => setAddingTitle(true)}>
            <Plus className="mr-1 size-3.5" /> Nový checklist
          </Button>
        ) : null}
      </div>

      {addingTitle ? (
        <div className="flex gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAddChecklist();
              if (e.key === "Escape") {
                setAddingTitle(false);
                setNewTitle("");
              }
            }}
            placeholder="Název checklistu…"
            autoFocus
            className="h-8"
          />
          <Button size="sm" onClick={() => void handleAddChecklist()}>
            Přidat
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAddingTitle(false);
              setNewTitle("");
            }}
          >
            Zrušit
          </Button>
        </div>
      ) : null}

      {checklists.map((cl) => {
        const total = cl.items.length;
        const done = cl.items.filter((i) => i.done).length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return (
          <div key={cl.id} className="space-y-2 rounded border p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">{cl.name}</h4>
              <ConfirmDialog
                trigger={
                  <Button size="icon" variant="ghost" className="size-6">
                    <Trash2 className="size-3" />
                  </Button>
                }
                title={`Smazat checklist „${cl.name}"?`}
                description="Smaže checklist včetně všech jeho položek."
                destructive
                confirmLabel="Smazat"
                onConfirm={() => handleDeleteChecklist(cl.id)}
              />
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {done} / {total} ({pct}%)
            </p>
            <div className="space-y-1">
              {cl.items.map((item) => (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  boardMembers={boardMembers}
                  onUpdate={(updated) =>
                    setChecklists((prev) =>
                      prev.map((c) =>
                        c.id === cl.id
                          ? {
                              ...c,
                              items: c.items.map((i) =>
                                i.id === updated.id ? updated : i,
                              ),
                            }
                          : c,
                      ),
                    )
                  }
                  onDelete={() =>
                    setChecklists((prev) =>
                      prev.map((c) =>
                        c.id === cl.id
                          ? { ...c, items: c.items.filter((i) => i.id !== item.id) }
                          : c,
                      ),
                    )
                  }
                />
              ))}
              <ChecklistItemAddInline checklistId={cl.id} onAdd={handleAddItem} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChecklistItemAddInline({
  checklistId,
  onAdd,
}: {
  checklistId: string;
  onAdd: (id: string, text: string) => void | Promise<void>;
}) {
  const [active, setActive] = useState(false);
  const [text, setText] = useState("");

  async function handleAdd() {
    const trimmed = text.trim();
    if (!trimmed) {
      setActive(false);
      setText("");
      return;
    }
    await onAdd(checklistId, trimmed);
    setText("");
  }

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className="flex w-full items-center gap-2 rounded px-1 py-1 text-xs text-muted-foreground hover:bg-muted/40"
      >
        <Plus className="size-3" /> Přidat položku
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleAdd();
          if (e.key === "Escape") {
            setActive(false);
            setText("");
          }
        }}
        placeholder="Položka…"
        autoFocus
        className="h-7 text-sm"
      />
      <Button size="sm" onClick={() => void handleAdd()}>
        Přidat
      </Button>
    </div>
  );
}
