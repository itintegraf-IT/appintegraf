"use client";

import { Trash2, X } from "lucide-react";
import { Button } from "@/components/projekty/ui/button";
import { ConfirmDialog } from "@/components/projekty/ui/confirm-dialog";
import { useBulkSelection } from "./BulkSelectionContext";
import { BulkMoveListPicker } from "./BulkMoveListPicker";
import { BulkLabelsPicker } from "./BulkLabelsPicker";
import { BulkMembersPicker } from "./BulkMembersPicker";
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
  onAction,
}: {
  lists: ListLite[];
  labels: LabelLite[];
  members: MemberLite[];
  onAction: () => void;
}) {
  const sel = useBulkSelection();
  const isTouch = useIsTouchDevice();
  // Threshold 2+ — pro 1 vybranou kartu jen border highlight, žádný bar.
  // Bulk akce dávají smysl od dvou (jinak má user detail modal pro single).
  // Bulk select je desktop-only (per ADR 0029) — modifier keys (Cmd/Ctrl/Shift)
  // nelze triggerovat na touch, takže celou UI skryjeme.
  if (sel.count < 2 || isTouch) return null;

  async function handleDelete() {
    try {
      const res = await fetch("/api/projekty/cards/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: [...sel.selectedIds] }),
      });
      if (!res.ok) throw new Error("API error");
      toast.success(`${sel.count} karet archivováno`);
      sel.clear();
      onAction();
    } catch {
      toast.error("Archivace se nezdařila");
      throw new Error("delete failed");
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
      <ConfirmDialog
        trigger={
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-1 size-3.5" />
            Smazat
          </Button>
        }
        title={`Smazat ${sel.count} karet?`}
        description="Karty budou přesunuty do archivu. Lze je později obnovit."
        confirmLabel="Smazat"
        destructive
        onConfirm={handleDelete}
      />
      <span className="h-5 w-px bg-border" aria-hidden />
      <Button variant="ghost" size="sm" onClick={() => sel.clear()} aria-label="Zrušit výběr (Esc)">
        <X className="mr-1 size-3.5" />
        Zrušit
      </Button>
    </div>
  );
}
