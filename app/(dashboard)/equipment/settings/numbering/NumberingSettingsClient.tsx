"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Hash } from "lucide-react";
import { EquipmentDialog } from "../../_components/EquipmentDialog";
import { readApiResponse } from "@/lib/equipment/api-response";

type Props = {
  start: number | null;
  lastIssued: number | null;
  maxInDb: number | null;
  minAllowed: number;
  nextTag: string | null;
};

const errorClass = "flex items-start gap-2 text-sm font-medium text-primary dark:text-(--danger)";

export function NumberingSettingsClient({ start, lastIssued, maxInDb, minAllowed, nextTag }: Props) {
  const router = useRouter();
  // Ptáme se na poslední číslo v ABRA Gen — +1 dopočítá aplikace (žádné počítání z hlavy).
  const [lastGen, setLastGen] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedStart, setSavedStart] = useState<number | null>(null);

  const trimmed = lastGen.trim();
  const lastGenNumber = /^1\d{5}$/.test(trimmed) ? Number(trimmed) : null;
  const newStart = lastGenNumber !== null ? lastGenNumber + 1 : null;
  const inputError =
    trimmed === ""
      ? null
      : lastGenNumber === null
        ? "Zadejte šestimístné číslo řady drobného majetku (např. 100875)."
        : newStart! < minAllowed
          ? `Aplikace už použila čísla do ${minAllowed - 1} — start řady musí být aspoň ${minAllowed}.`
          : null;
  const canSubmit = newStart !== null && inputError === null && !saving;

  const save = async () => {
    if (newStart === null) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/equipment/settings/asset-numbering", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: newStart }),
      });
      const result = await readApiResponse<{ ok: true; start: number }>(res, "Nastavení se nepodařilo uložit.");
      setConfirmOpen(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedStart(result.data.start);
      setLastGen("");
      router.refresh();
    } catch {
      setConfirmOpen(false);
      setError("Spojení se serverem selhalo. Nastavení se možná neuložilo — obnovte stránku a zkontrolujte ho.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Hash className="h-7 w-7 text-primary" aria-hidden />
            Inventární čísla
          </h1>
          <p className="mt-1 text-muted-foreground">
            Číselná řada drobného majetku. Navazuje na řadu 100xxx z účetnictví.
          </p>
        </div>
        <Link
          href="/equipment/settings"
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm hover:bg-muted"
        >
          Zpět
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Start řady</dt>
            <dd className="mt-0.5 font-mono text-base">{start ?? "nenastaven"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Nejvyšší číslo řady v aplikaci</dt>
            <dd className="mt-0.5 font-mono text-base">{maxInDb ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Poslední vydané aplikací</dt>
            <dd className="mt-0.5 font-mono text-base">{lastIssued ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Další přidělené číslo</dt>
            <dd className="mt-0.5 font-mono text-base">{nextTag ?? "—"}</dd>
          </div>
        </dl>

        {start == null ? (
          <p role="status" className={`mt-4 ${errorClass}`}>
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Řada zatím není nastavená. Dokud ji nenastavíte, nový majetek s automatickým číslem nejde uložit.
          </p>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) setConfirmOpen(true);
          }}
          className="mt-5 space-y-3"
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Poslední inventární číslo drobného majetku v ABRA Gen
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={lastGen}
              onChange={(e) => {
                setLastGen(e.target.value);
                setSavedStart(null);
              }}
              placeholder="např. 100875"
              aria-invalid={inputError ? true : undefined}
              aria-describedby="series-last-hint"
              className="w-48 rounded-lg border border-border bg-background px-3 py-2 font-mono aria-[invalid=true]:border-primary"
            />
          </label>
          <p id="series-last-hint" className="text-sm text-muted-foreground">
            Opište nejvyšší číslo řady 100xxx, které už v ABRA Gen existuje. Aplikace pak čísluje od dalšího čísla
            postupně a žádné číslo nepoužije dvakrát.
          </p>
          {inputError ? (
            <p className={errorClass}>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {inputError}
            </p>
          ) : newStart !== null ? (
            <p className="text-sm">
              První číslo, které přidělí aplikace: <span className="font-mono font-semibold">{newStart}</span>
            </p>
          ) : null}
          <button
            type="submit"
            disabled={!canSubmit}
            className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {start == null ? "Nastavit řadu…" : "Změnit start řady…"}
          </button>
          {error ? (
            <p role="alert" className={errorClass}>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
          {savedStart !== null ? (
            <p role="status" className="flex items-start gap-2 text-sm font-medium">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-(--success)" aria-hidden />
              Uloženo. Aplikace přidělí jako další číslo nejméně {savedStart}.
            </p>
          ) : null}
        </form>
      </div>

      <EquipmentDialog
        open={confirmOpen}
        title={`Nastavit start řady na ${newStart ?? ""}?`}
        confirmLabel="Nastavit řadu"
        busy={saving}
        onConfirm={() => void save()}
        onCancel={() => setConfirmOpen(false)}
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Poslední číslo v ABRA Gen</dt>
          <dd className="font-mono">{lastGenNumber}</dd>
          <dt className="text-muted-foreground">První číslo z aplikace</dt>
          <dd className="font-mono font-semibold">{newStart}</dd>
        </dl>
        <p className="mt-3 text-sm">
          Čísla od {newStart} výš bude přidělovat jen aplikace — v ABRA Gen je pro drobný majetek už nepoužívejte.
          Jakmile aplikace číslo vydá, start už nejde snížit pod něj.
        </p>
      </EquipmentDialog>
    </div>
  );
}
