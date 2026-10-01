"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Trash2 } from "lucide-react";
import { EquipmentDialog } from "../_components/EquipmentDialog";

type Props = {
  equipmentId: number;
  itemName: string;
  /** Důvod, proč položku smazat nejde (má historii); `null` = smazat lze. */
  blockReason: string | null;
};

export function DeleteItemButton({ equipmentId, itemName, blockReason }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setError(null);
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/equipment/${equipmentId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Položku se nepodařilo smazat.");
        return;
      }
      router.push("/equipment");
      router.refresh();
    } catch {
      setError("Spojení se serverem selhalo. Nic se nesmazalo — zkuste to znovu.");
    } finally {
      setBusy(false);
    }
  };

  const blocked = blockReason !== null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-muted-foreground hover:bg-muted"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Smazat
      </button>
      <EquipmentDialog
        open={open}
        title={blocked ? "Položku nelze smazat" : `Smazat „${itemName}“?`}
        destructive={!blocked}
        confirmLabel={blocked ? undefined : "Smazat položku"}
        cancelLabel={blocked ? "Rozumím" : "Zrušit"}
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={close}
      >
        {blocked ? (
          <p>{blockReason}</p>
        ) : (
          <p>
            Smazání je nevratné. Používejte ho jen pro položku založenou omylem — položka nemá žádnou historii, fotky
            ani přílohy.
          </p>
        )}
        {error ? (
          <p role="alert" className="mt-3 flex items-start gap-2 font-medium text-primary">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
      </EquipmentDialog>
    </>
  );
}
