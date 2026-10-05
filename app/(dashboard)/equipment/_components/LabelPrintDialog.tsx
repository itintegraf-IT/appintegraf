"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Printer } from "lucide-react";
import { EquipmentDialog } from "./EquipmentDialog";
import { readApiResponse, readPdfResponse } from "@/lib/equipment/api-response";
import { labelsPerPage, nextStartPosition, type EquipmentLabelGridSpec } from "@/lib/equipment/label-layout";
import { labelsCountLabel } from "@/lib/equipment/label-text";

/** Kde na archu tisk naposledy skončil — další tisk v téže relaci na něj naváže. */
const NEXT_START_KEY = "equipment-label-next-start";

function readStoredStart(): number | null {
  try {
    const value = Number(sessionStorage.getItem(NEXT_START_KEY));
    return Number.isInteger(value) && value >= 1 ? value : null;
  } catch {
    return null;
  }
}

function storeStart(value: number) {
  try {
    sessionStorage.setItem(NEXT_START_KEY, String(value));
  } catch {
    // Bez úložiště začne příští tisk na pozici 1.
  }
}

function SheetPicker({
  spec,
  start,
  count,
  onPick,
}: {
  spec: EquipmentLabelGridSpec;
  start: number;
  count: number;
  onPick: (position: number) => void;
}) {
  const perPage = labelsPerPage(spec);
  const lastOnSheet = Math.min(perPage, start + count - 1);
  return (
    <div
      className="grid w-full max-w-60 gap-1 rounded-md border border-border bg-muted p-1.5"
      style={{ gridTemplateColumns: `repeat(${spec.cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: perPage }, (_, i) => {
        const position = i + 1;
        const used = position < start;
        const printing = position >= start && position <= lastOnSheet;
        return (
          <button
            key={position}
            type="button"
            onClick={() => onPick(position)}
            aria-label={`Začít na pozici ${position}`}
            aria-pressed={position === start}
            className={`rounded-sm border text-[10px] leading-none ${
              used
                ? "border-transparent bg-border text-muted-foreground"
                : printing
                  ? "border-primary bg-primary/15 font-semibold text-foreground"
                  : "border-dashed border-border bg-card text-muted-foreground"
            } ${position === start ? "ring-2 ring-primary" : ""}`}
            style={{ aspectRatio: `${spec.labelWidthMm} / ${spec.labelHeightMm}` }}
          >
            {position}
          </button>
        );
      })}
    </div>
  );
}

type Props = {
  open: boolean;
  kind: "item" | "room";
  ids: number[];
  /** Smí potvrdit vytištění (zápis do skupiny položek / správa evidence u místností). */
  canConfirm: boolean;
  onClose: () => void;
  /** Po potvrzení: potvrzená ID (server z nich zapsal jen tisknutelné) a počet zapsaných. */
  onConfirmed?: (ids: number[], updated: number) => void;
};

/**
 * Tisk štítků: výběr pozice na načatém archu → stažení PDF → potvrzení, že se štítky
 * opravdu vytiskly. Teprve potvrzení zapíše štítky jako vytištěné.
 */
export function LabelPrintDialog({ open, kind, ids, canConfirm, onClose, onConfirmed }: Props) {
  const [spec, setSpec] = useState<EquipmentLabelGridSpec | null>(null);
  const [start, setStart] = useState(1);
  const [step, setStep] = useState<"setup" | "confirm">("setup");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [printedCount, setPrintedCount] = useState(0);
  const [skipped, setSkipped] = useState(0);

  useEffect(() => {
    if (!open) return;
    fetch("/api/equipment/settings/label-grid")
      .then((res) =>
        readApiResponse<{ activeSpec: EquipmentLabelGridSpec }>(res, "Nastavení štítků se nepodařilo načíst.")
      )
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSpec(result.data.activeSpec);
        const stored = readStoredStart();
        setStart(stored && stored <= labelsPerPage(result.data.activeSpec) ? stored : 1);
      })
      .catch(() => setError("Spojení se serverem selhalo. Zkuste to znovu."));
  }, [open]);

  const perPage = spec ? labelsPerPage(spec) : 1;

  const close = () => {
    setStep("setup");
    setError("");
    setPrintedCount(0);
    setSkipped(0);
    onClose();
  };

  const download = () => {
    if (!spec || busy) return;
    setBusy(true);
    setError("");
    fetch(kind === "item" ? "/api/equipment/labels" : "/api/equipment/rooms/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, startPosition: start }),
    })
      .then((res) => readPdfResponse(res, "PDF štítků se nepodařilo připravit."))
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
          return;
        }
        const printed = Number(result.headers.get("x-labels-count")) || 0;
        setPrintedCount(printed);
        setSkipped(Number(result.headers.get("x-labels-skipped")) || 0);
        const href = URL.createObjectURL(result.blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = kind === "item" ? "majetek-stitky.pdf" : "stitky-mistnosti.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 60_000);
        if (!canConfirm) storeStart(nextStartPosition(start, printed, perPage));
        setStep("confirm");
      })
      .catch(() => setError("Spojení se serverem selhalo. Nic se nestáhlo — zkuste to znovu."))
      .finally(() => setBusy(false));
  };

  const confirmPrinted = () => {
    if (busy) return;
    setBusy(true);
    setError("");
    fetch("/api/equipment/labels/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ids, printed: true }),
    })
      .then((res) => readApiResponse<{ updated: number }>(res, "Potvrzení se nepodařilo uložit."))
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
          return;
        }
        storeStart(nextStartPosition(start, printedCount, perPage));
        onConfirmed?.(ids, result.data.updated);
        close();
      })
      .catch(() => setError("Spojení se serverem selhalo. Nic se neuložilo — zkuste to znovu."))
      .finally(() => setBusy(false));
  };

  const errorBox = error ? (
    <p role="alert" className="flex items-start gap-2 font-medium text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      {error}
    </p>
  ) : null;

  if (step === "confirm") {
    return (
      <EquipmentDialog
        open={open}
        title="Vytiskly se štítky správně?"
        confirmLabel={canConfirm ? "Ano, označit jako vytištěné" : undefined}
        cancelLabel={canConfirm ? "Ne, zatím ne" : "Hotovo"}
        busy={busy}
        onConfirm={confirmPrinted}
        onCancel={close}
      >
        <div className="flex flex-col gap-3">
          <p>
            PDF ({labelsCountLabel(printedCount)}) je stažené. Vytiskněte ho a zkontrolujte, že QR kód i text jsou
            celé.
          </p>
          {skipped > 0 ? (
            <p className="font-medium text-foreground">
              {labelsCountLabel(skipped)} se nevytiskne — položka nemá QR kód.
            </p>
          ) : null}
          <p>
            {canConfirm
              ? "Teprve potvrzení zapíše štítky jako vytištěné; zmizí z filtru Bez štítku."
              : "Vytištění potvrdí správa evidence."}
          </p>
          {errorBox}
        </div>
      </EquipmentDialog>
    );
  }

  return (
    <EquipmentDialog
      open={open}
      title={`Tisk štítků — ${labelsCountLabel(ids.length)}`}
      confirmLabel={busy ? "Připravuji PDF…" : "Stáhnout PDF"}
      busy={busy || !spec}
      onConfirm={download}
      onCancel={close}
    >
      <div className="flex flex-col gap-3">
        <p>
          {spec
            ? `Arch ${spec.labelWidthMm} × ${spec.labelHeightMm} mm, ${perPage} štítků na stránku.`
            : "Načítám nastavení štítků…"}
        </p>
        <label htmlFor="label-start" className="flex flex-wrap items-center gap-2 font-medium text-foreground">
          Začít na pozici
          <input
            id="label-start"
            type="number"
            min={1}
            max={perPage}
            value={start}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isInteger(value) && value >= 1 && value <= perPage) setStart(value);
            }}
            className="min-h-11 w-24 rounded-lg border border-border bg-card px-3 text-base"
          />
          <span className="font-normal text-muted-foreground">z {perPage}</span>
        </label>
        {spec ? <SheetPicker spec={spec} start={start} count={ids.length} onPick={setStart} /> : null}
        <p className="flex items-start gap-2">
          <Printer className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Tiskněte ve skutečné velikosti (100 %) — v dialogu tisku vypněte „Přizpůsobit stránce“.
        </p>
        {errorBox}
      </div>
    </EquipmentDialog>
  );
}
