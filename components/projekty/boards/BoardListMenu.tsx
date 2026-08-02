"use client";

import { useState } from "react";
import { Button } from "@/components/projekty/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/projekty/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/projekty/ui/dropdown-menu";
import { MoreHorizontal, Archive, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LIST_PRESET_COLORS } from "@/lib/projekty/list-colors";

type Props = {
  list: { id: string; name: string; color: string | null; archived: boolean };
  onDelete: () => void;
  onArchive: (archived: boolean) => void;
  onColorChange?: (color: string) => void;
};

export function BoardListMenu({ list, onDelete, onArchive, onColorChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleArchive() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projekty/lists/${list.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: !list.archived }),
      });
      if (!res.ok) {
        toast.error("Archivace selhala.");
        return;
      }
      onArchive(!list.archived);
    } catch {
      toast.error("Archivace selhala (chyba sítě).");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projekty/lists/${list.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Smazání selhalo.");
        return;
      }
      onDelete();
      setConfirmOpen(false);
    } catch {
      toast.error("Smazání selhalo (chyba sítě).");
    } finally {
      setBusy(false);
    }
  }

  async function handleColorChange(color: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projekty/lists/${list.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ color }),
      });
      if (!res.ok) {
        toast.error("Změna barvy selhala.");
        return;
      }
      onColorChange?.(color);
    } catch {
      toast.error("Změna barvy selhala (chyba sítě).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:bg-muted"
            disabled={busy}
            aria-label="Menu sloupce"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs">Barva</DropdownMenuLabel>
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            {LIST_PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  void handleColorChange(c.value);
                }}
                className={`size-5 rounded transition-all ${
                  list.color === c.value ? "ring-2 ring-foreground ring-offset-1" : ""
                }`}
                style={{ backgroundColor: c.dot }}
                aria-label={`Barva — ${c.label}`}
                title={c.label}
              />
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void handleArchive()}>
            <Archive className="mr-2 size-4" />
            {list.archived ? "Obnovit" : "Archivovat"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
            className="text-destructive"
          >
            <Trash2 className="mr-2 size-4" />
            Smazat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat sloupec „{list.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Sloupec a všechny jeho karty budou trvale odstraněny. Tato akce je nevratná.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {busy ? "…" : "Smazat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
