"use client";

import { Archive, X } from "lucide-react";
import { Button } from "@/components/projekty/ui/button";
import { useBulkSelection } from "./BulkSelectionContext";
import { BulkMoveListPicker } from "./BulkMoveListPicker";
import { BulkLabelsPicker } from "./BulkLabelsPicker";
import { BulkMembersPicker } from "./BulkMembersPicker";
import { BulkPriorityPicker } from "./BulkPriorityPicker";
import type { CardPriorityValue } from "@/lib/projekty/priority";
import { cn } from "@/lib/projekty/utils";
import { toast } from "sonner";
import { useIsTouchDevice } from "@/hooks/projekty/useIsTouchDevice";

type ListLite = { id: string; name: string };
type LabelLite = { id: string; name: string; color: string };
type MemberLite = { id: number; name: string | null; email: string | null; image: string | null };

export function BulkActionBar({
  lists,
  labels,
  members,
  cardPriorities,
  onAction,
}: {
  lists: ListLite[];
  labels: LabelLite[];
  members: MemberLite[];
  cardPriorities: Record<string, CardPriorityValue | null>;
  onAction: () => void;
}) {
  const sel = useBulkSelection();
  const isTouch = useIsTouchDevice();
  // Threshold 2+ — pro 1 vybranou kartu jen border highlight, žádný bar.
  // Bulk akce dávají smysl od dvou (jinak má user detail modal pro single).
  // Bulk select je desktop-only (per ADR 0029) — modifier keys (Cmd/Ctrl/Shift)
  // nelze triggerovat na touch, takže celou UI skryjeme.
  if (sel.count < 2 || isTouch) return null;

  async function handleArchive() {
    const ids = [...sel.selectedIds];
    try {
      const res = await fetch("/api/projekty/cards/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: ids }),
      });
      if (!res.ok) throw new Error("API error");
      // Vratná akce — místo potvrzovacího dialogu undo toast
      toast.success(`${ids.length} karet archivováno`, {
        action: {
          label: "Zpět",
          onClick: () => {
            void fetch("/api/projekty/cards/bulk", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "archive",
                cardIds: ids,
                payload: { archived: false },
              }),
            }).then((r) => {
              if (r.ok) onAction();
              else toast.error("Obnovení karet selhalo.");
            });
          },
        },
      });
      sel.clear();
      onAction();
    } catch {
      toast.error("Archivace se nezdařila");
    }
  }

  return (
    <div
      role="toolbar"
      aria-label={`${sel.count} karet vybrané — bulk akce`}
      className={cn(
        "fixed left-1/2 z-30 flex -translate-x-1/2 items-center gap-2",
        "bottom-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))]",
        "rounded-lg border bg-popover p-2 shadow-lg",
        "transition-opacity duration-150",
      )}
    >
      <span className="px-2 text-sm font-medium">{sel.count} vybráno</span>
      <span className="h-5 w-px bg-border" aria-hidden />
      <BulkMoveListPicker lists={lists} onMoved={onAction} />
      <BulkLabelsPicker labels={labels} onApplied={onAction} />
      <BulkMembersPicker members={members} onApplied={onAction} />
      <BulkPriorityPicker cardPriorities={cardPriorities} onApplied={onAction} />
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => void handleArchive()}
      >
        <Archive className="mr-1 size-3.5" />
        Archivovat
      </Button>
      <span className="h-5 w-px bg-border" aria-hidden />
      <Button variant="ghost" size="sm" onClick={() => sel.clear()} aria-label="Zrušit výběr (Esc)">
        <X className="mr-1 size-3.5" />
        Zrušit
      </Button>
    </div>
  );
}
