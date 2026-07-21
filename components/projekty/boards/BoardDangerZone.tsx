"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/projekty/ui/button";
import { ConfirmDialog } from "@/components/projekty/ui/confirm-dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export function BoardDangerZone({
  boardId,
  boardName,
  canDelete,
}: { boardId: string; boardName: string; canDelete: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projekty/boards/${boardId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Smazání selhalo.");
        return;
      }
      toast.success("Board smazán.");
      router.push("/projekty/boards");
    } catch {
      toast.error("Smazání selhalo (chyba sítě).");
    } finally {
      setBusy(false);
    }
  }

  if (!canDelete) return null;

  return (
    <section className="rounded border border-destructive/30 p-4 space-y-3">
      <h2 className="text-lg font-semibold text-destructive">Nebezpečná zóna</h2>
      <p className="text-sm text-muted-foreground">
        Smazání boardu odstraní všechny sloupce, karty a labely. Tato akce je nevratná.
      </p>
      <ConfirmDialog
        trigger={
          <Button variant="destructive" disabled={busy}>
            <Trash2 className="mr-2 size-4" />
            Smazat board
          </Button>
        }
        title={`Smazat board „${boardName}"?`}
        description="Smaže všechny sloupce, karty a labely. Tato akce je nevratná."
        destructive
        confirmLabel="Smazat"
        onConfirm={handleDelete}
      />
    </section>
  );
}
