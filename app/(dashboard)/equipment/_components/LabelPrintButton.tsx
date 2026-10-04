"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, QrCode } from "lucide-react";
import { LabelPrintDialog } from "./LabelPrintDialog";
import { readApiResponse } from "@/lib/equipment/api-response";

const dateFormat = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Europe/Prague" });

type Props = {
  kind: "item" | "room";
  id: number;
  /** ISO datum potvrzeného tisku, nebo null. */
  printedAt: string | null;
  canConfirm: boolean;
  /** Bez něj se po změně obnoví stránka (server komponenty). */
  onChanged?: () => void;
};

/** Tlačítko Tisk štítku na detailu položky nebo místnosti + stav vytištění. */
export function LabelPrintButton({ kind, id, printedAt, canConfirm, onChanged }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = () => (onChanged ? onChanged() : router.refresh());

  const unmark = () => {
    setBusy(true);
    setError("");
    fetch("/api/equipment/labels/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ids: [id], printed: false }),
    })
      .then((res) => readApiResponse<{ updated: number }>(res, "Změnu se nepodařilo uložit."))
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
          return;
        }
        refresh();
      })
      .catch(() => setError("Spojení se serverem selhalo. Nic se neuložilo — zkuste to znovu."))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 font-medium hover:bg-muted"
        >
          <QrCode className="h-4 w-4" aria-hidden />
          Tisk štítku
        </button>
        {printedAt ? (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-(--success)" aria-hidden />
            Štítek vytištěn {dateFormat.format(new Date(printedAt))}
          </span>
        ) : null}
        {printedAt && canConfirm ? (
          <button
            type="button"
            onClick={unmark}
            disabled={busy}
            className="min-h-11 px-2 text-sm text-muted-foreground underline hover:text-foreground disabled:opacity-50"
          >
            Označit jako nevytištěný
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <LabelPrintDialog
        open={open}
        kind={kind}
        ids={[id]}
        canConfirm={canConfirm}
        onClose={() => setOpen(false)}
        onConfirmed={refresh}
      />
    </div>
  );
}
