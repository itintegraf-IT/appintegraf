"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Edit, Copy, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  dealId: string;
  canEdit: boolean;
  canDelete: boolean;
};

export function DealActionsMenu({ dealId, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/duplicate`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Duplikace selhala.");
      }
      const created = (await res.json()) as { id: string };
      toast.success("Deal duplikován.");
      router.push(`/crm/deals/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chyba duplikace.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/deals/${dealId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Smazání selhalo.");
      }
      toast.success("Deal smazán.");
      router.push("/crm/deals");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chyba mazání.");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Více akcí"
            className="inline-flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/70 active:scale-95"
          >
            <MoreHorizontal className="size-5" strokeWidth={2} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2">
          {canEdit ? (
            <DropdownMenuItem
              onSelect={() => router.push(`/crm/deals/${dealId}/edit`)}
              className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm"
            >
              <Edit className="size-4 text-muted-foreground" strokeWidth={1.75} />
              <span>Upravit</span>
            </DropdownMenuItem>
          ) : null}
          {canEdit ? (
            <DropdownMenuItem
              disabled={busy}
              onSelect={() => duplicate()}
              className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm"
            >
              <Copy className="size-4 text-muted-foreground" strokeWidth={1.75} />
              <span>Duplikovat</span>
            </DropdownMenuItem>
          ) : null}
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={busy}
                onSelect={() => setConfirmDelete(true)}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" strokeWidth={1.75} />
                <span>Smazat</span>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Smazat obchodní případ?</DialogTitle>
            <DialogDescription>
              Tato akce je nevratná. Smaže deal včetně aktivit, poznámek a příloh.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Zrušit
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              {busy ? "Mažu…" : "Smazat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
