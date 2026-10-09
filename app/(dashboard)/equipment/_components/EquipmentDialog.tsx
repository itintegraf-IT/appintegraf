"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  children?: ReactNode;
  /** Bez potvrzovacího tlačítka zůstane jen zavírací (např. vysvětlení, proč akce nejde). */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Nevratná akce — titulek dostane výstražnou ikonu. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm?: () => void;
  onCancel: () => void;
};

/**
 * Potvrzovací dialog modulu Majetek. Nativní `<dialog>` + `showModal()`
 * zajistí zachycení fokusu a zavření klávesou Escape. `m-auto` vrací
 * centrování, které reset stylů Tailwindu (margin: 0) jinak zruší.
 */
export function EquipmentDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Zrušit",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      // Prohlížeč může dialog zavřít i sám (např. tlačítko Zpět na Androidu) — srovnat stav.
      onClose={() => {
        if (open) onCancel();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl backdrop:bg-black/40"
    >
      <h2 id={titleId} className="flex items-start gap-2 text-lg font-semibold">
        {destructive ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-primary dark:text-destructive" aria-hidden /> : null}
        {title}
      </h2>
      <div className="mt-3 text-sm text-muted-foreground">{children}</div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="min-h-11 rounded-lg border border-border px-4 font-medium hover:bg-muted disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        {confirmLabel && onConfirm ? (
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Pracuji…" : confirmLabel}
          </button>
        ) : null}
      </div>
    </dialog>
  );
}
