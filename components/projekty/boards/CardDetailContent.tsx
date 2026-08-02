"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/projekty/ui/button";
import { Input } from "@/components/projekty/ui/input";
import { Checkbox } from "@/components/projekty/ui/checkbox";
import { Archive } from "lucide-react";
import { CardDueDatePicker } from "./CardDueDatePicker";
import { CardPriorityPicker } from "./CardPriorityPicker";
import { CardDescriptionEditor } from "./CardDescriptionEditor";
import { CardMembersPicker } from "./CardMembersPicker";
import { CardLabelsPicker } from "./CardLabelsPicker";
import { CardChecklistSection, type Checklist } from "./CardChecklistSection";
import { CardCommentsSection } from "./CardCommentsSection";
import { CardAttachmentsSection } from "./CardAttachmentsSection";
import { CardActivityFeed } from "./CardActivityFeed";
import type { CardPriorityValue } from "@/lib/projekty/priority";

type UserLite = { id: number; email: string | null; name: string | null; image: string | null };
type Label = { id: string; name: string; color: string };

export type FullCard = {
  id: string;
  number: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  startDate: string | null;
  completed: boolean;
  cover: string | null;
  archived: boolean;
  priority: CardPriorityValue | null;
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

/**
 * Prezentační tělo detailu karty — sdílené mezi side panelem (CardDetailPanel)
 * a plnou stránkou (CardDetailPage). Data a mutační logika žijí v containeru.
 */
export function CardDetailContent({
  card,
  currentUserId,
  onPatch,
  onCardChange,
  onArchive,
}: {
  card: FullCard;
  currentUserId: number;
  onPatch: (patch: Record<string, unknown>) => Promise<void>;
  onCardChange: (updater: (prev: FullCard) => FullCard) => void;
  onArchive: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [savingTitle, setSavingTitle] = useState(false);

  // Reset draftu titulku jen při přepnutí karty (ne při každém refresh merge)
  useEffect(() => {
    setTitle(card.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  async function handleTitleBlur() {
    if (title.trim() === card.title || !title.trim()) {
      setTitle(card.title);
      return;
    }
    setSavingTitle(true);
    await onPatch({ title: title.trim() });
    setSavingTitle(false);
  }

  const boardMembersForPicker = card.list.board.members.map((m) => m.user);
  const assignedUserIds = card.members.map((m) => m.userId);
  const boardLabels = card.list.board.labels;
  const assignedLabelIds = card.labels.map((l) => l.labelId);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void handleTitleBlur()}
          disabled={savingTitle}
          className="text-lg font-semibold"
        />
        <p className="text-xs text-muted-foreground">v sloupci „{card.list.name}&ldquo;</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <Checkbox
            checked={card.completed}
            onCheckedChange={(v) => void onPatch({ completed: Boolean(v) })}
          />
          <span className="text-sm">Dokončeno</span>
        </label>

        <CardDueDatePicker
          value={card.dueDate ? new Date(card.dueDate) : null}
          completed={card.completed}
          onChange={(date) => void onPatch({ dueDate: date ? date.toISOString() : null })}
        />

        <CardPriorityPicker
          value={card.priority}
          onChange={(priority) => void onPatch({ priority })}
        />

        <CardMembersPicker
          cardId={card.id}
          assignedUserIds={assignedUserIds}
          boardMembers={boardMembersForPicker}
          onChange={(newIds) => {
            onCardChange((prev) => ({
              ...prev,
              members: newIds.flatMap((uid) => {
                const existing = prev.members.find((m) => m.userId === uid);
                if (existing) return [existing];
                const user = boardMembersForPicker.find((u) => u.id === uid);
                return user ? [{ userId: uid, user }] : [];
              }),
            }));
          }}
        />

        <CardLabelsPicker
          cardId={card.id}
          assignedLabelIds={assignedLabelIds}
          boardLabels={boardLabels}
          onChange={(newIds) => {
            onCardChange((prev) => ({
              ...prev,
              labels: newIds.flatMap((lid) => {
                const existing = prev.labels.find((l) => l.labelId === lid);
                if (existing) return [existing];
                const label = boardLabels.find((l) => l.id === lid);
                return label ? [{ labelId: lid, label }] : [];
              }),
            }));
          }}
        />
      </div>

      {/* Description */}
      <section className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-[13px] font-semibold tracking-tight">Popis</h3>
        <CardDescriptionEditor
          value={card.description ?? ""}
          onSave={async (newValue) => {
            await onPatch({ description: newValue || null });
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
        <Button variant="outline" size="sm" onClick={onArchive}>
          <Archive className="mr-2 size-4" />
          Archivovat kartu
        </Button>
      </div>
    </div>
  );
}
