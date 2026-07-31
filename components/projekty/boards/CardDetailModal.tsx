"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ResponsiveDialog } from "@/components/projekty/ui/responsive-dialog";
import { Button } from "@/components/projekty/ui/button";
import { ConfirmDialog } from "@/components/projekty/ui/confirm-dialog";
import { Input } from "@/components/projekty/ui/input";
import { Checkbox } from "@/components/projekty/ui/checkbox";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CardDueDatePicker } from "./CardDueDatePicker";
import { CardDescriptionEditor } from "./CardDescriptionEditor";
import { CardMembersPicker } from "./CardMembersPicker";
import { CardLabelsPicker } from "./CardLabelsPicker";
import { CardChecklistSection, type Checklist } from "./CardChecklistSection";
import { CardCommentsSection } from "./CardCommentsSection";
import { CardAttachmentsSection } from "./CardAttachmentsSection";
import { CardActivityFeed } from "./CardActivityFeed";

type UserLite = { id: number; email: string | null; name: string | null; image: string | null };
type Label = { id: string; name: string; color: string };

type FullCard = {
  id: string;
  number: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  startDate: string | null;
  completed: boolean;
  cover: string | null;
  archived: boolean;
  list: {
    id: string;
    name: string;
    board: {
      id: string;
      ownerId: number;
      members: { userId: number; user: UserLite }[];
      labels: Label[];
    };
  };
  members: { userId: number; user: UserLite }[];
  labels: { labelId: string; label: Label }[];
  checklists: Checklist[];
};

export function CardDetailModal({
  cardId,
  currentUserId,
  open,
  onOpenChange,
}: {
  cardId: string | null;
  currentUserId: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [card, setCard] = useState<FullCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!cardId || !open) {
      setCard(null);
      return;
    }
    setLoading(true);
    fetch(`/api/projekty/cards/${cardId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("HTTP " + res.status))))
      .then((data: { card: FullCard }) => {
        setCard(data.card);
        setTitle(data.card.title);
      })
      .catch(() => toast.error("Načtení karty selhalo."))
      .finally(() => setLoading(false));
  }, [cardId, open]);

  async function patchCard(patch: Record<string, unknown>) {
    if (!cardId) return;
    try {
      const res = await fetch(`/api/projekty/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        toast.error("Uložení selhalo.");
        return;
      }
      const { card: updated } = (await res.json()) as { card: Partial<FullCard> };
      setCard((prev) => (prev ? { ...prev, ...updated } : prev));
      router.refresh();
    } catch {
      toast.error("Uložení selhalo (chyba sítě).");
    }
  }

  async function handleTitleBlur() {
    if (!card || title.trim() === card.title || !title.trim()) {
      setTitle(card?.title ?? "");
      return;
    }
    setSavingTitle(true);
    await patchCard({ title: title.trim() });
    setSavingTitle(false);
  }

  async function handleDelete() {
    if (!cardId) return;
    try {
      const res = await fetch(`/api/projekty/cards/${cardId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Smazání selhalo.");
        return;
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Smazání selhalo (chyba sítě).");
    }
  }

  // Derived data for pickers
  const boardMembersForPicker = card ? card.list.board.members.map((m) => m.user) : [];
  const assignedUserIds = card?.members.map((m) => m.userId) ?? [];
  const boardLabels = card?.list.board.labels ?? [];
  const assignedLabelIds = card?.labels.map((l) => l.labelId) ?? [];

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={card?.number ?? ""}>
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Načítám…</div>
      ) : card ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => void handleTitleBlur()}
              disabled={savingTitle}
              className="text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">v sloupci „{card.list.name}"</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={card.completed}
                onCheckedChange={(v) => void patchCard({ completed: Boolean(v) })}
              />
              <span className="text-sm">Dokončeno</span>
            </label>

            <CardDueDatePicker
              value={card.dueDate ? new Date(card.dueDate) : null}
              completed={card.completed}
              onChange={(date) => void patchCard({ dueDate: date ? date.toISOString() : null })}
            />

            <CardMembersPicker
              cardId={card.id}
              assignedUserIds={assignedUserIds}
              boardMembers={boardMembersForPicker}
              onChange={(newIds) => {
                setCard((prev) =>
                  prev
                    ? {
                        ...prev,
                        members: newIds.map((uid) => {
                          const existing = prev.members.find((m) => m.userId === uid);
                          if (existing) return existing;
                          const user = boardMembersForPicker.find((u) => u.id === uid);
                          return user ? { userId: uid, user } : prev.members[0]!;
                        }),
                      }
                    : prev,
                );
                router.refresh();
              }}
            />

            <CardLabelsPicker
              cardId={card.id}
              assignedLabelIds={assignedLabelIds}
              boardLabels={boardLabels}
              onChange={(newIds) => {
                setCard((prev) =>
                  prev
                    ? {
                        ...prev,
                        labels: newIds.map((lid) => {
                          const existing = prev.labels.find((l) => l.labelId === lid);
                          if (existing) return existing;
                          const label = boardLabels.find((l) => l.id === lid);
                          return label ? { labelId: lid, label } : prev.labels[0]!;
                        }),
                      }
                    : prev,
                );
                router.refresh();
              }}
            />
          </div>

          {/* Description */}
          <section className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-[13px] font-semibold tracking-tight">Popis</h3>
            <CardDescriptionEditor
              value={card.description ?? ""}
              onSave={async (newValue) => {
                await patchCard({ description: newValue || null });
              }}
              cardId={card.id}
            />
          </section>

          {/* Checklists */}
          <section className="rounded-lg border bg-card p-4">
            <CardChecklistSection
              cardId={card.id}
              checklists={card.checklists ?? []}
              boardMembers={boardMembersForPicker}
            />
          </section>

          {/* Comments */}
          <section className="rounded-lg border bg-card p-4">
            <CardCommentsSection cardId={card.id} currentUserId={currentUserId} />
          </section>

          {/* Attachments */}
          <section className="rounded-lg border bg-card p-4">
            <CardAttachmentsSection cardId={card.id} currentUserId={currentUserId} />
          </section>

          {/* Activity */}
          <section className="rounded-lg border bg-card p-4">
            <CardActivityFeed cardId={card.id} />
          </section>

          <div className="flex justify-end pt-4">
            <ConfirmDialog
              trigger={
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 size-4" />
                  Smazat kartu
                </Button>
              }
              title="Smazat kartu?"
              description="Karta bude trvale odstraněna i s checklistem, komentáři a přílohami."
              destructive
              confirmLabel="Smazat"
              onConfirm={handleDelete}
            />
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-muted-foreground">Karta nenalezena.</div>
      )}
    </ResponsiveDialog>
  );
}
