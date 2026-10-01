"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Hash } from "lucide-react";

type Props = {
  start: number | null;
  lastIssued: number | null;
  maxInDb: number | null;
  minAllowed: number;
  nextTag: string | null;
};

export function NumberingSettingsClient({ start, lastIssued, maxInDb, minAllowed, nextTag }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(String(start ?? minAllowed));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/equipment/settings/asset-numbering", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Nastavení se nepodařilo uložit.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Spojení se serverem selhalo. Nic se neuložilo — zkuste to znovu.");
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
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          Zpět
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
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
          <p role="status" className="mt-4 flex items-start gap-2 text-sm font-medium text-primary">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Řada zatím není nastavená. Dokud ji nenastavíte, nový majetek s automatickým číslem nejde uložit.
          </p>
        ) : null}

        <form onSubmit={(e) => void save(e)} className="mt-5 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Start řady</span>
            <input
              type="text"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-48 rounded-lg border border-border bg-background px-3 py-2 font-mono"
              aria-describedby="series-start-hint"
            />
          </label>
          <p id="series-start-hint" className="text-sm text-muted-foreground">
            Zadejte poslední číslo drobného majetku z ABRA Gen + 1 (nejméně {minAllowed}). Čísla se přidělují
            postupně a nikdy se nepoužijí znovu.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Ukládám…" : "Uložit"}
          </button>
          {error ? (
            <p role="alert" className="flex items-start gap-2 text-sm font-medium text-primary">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
          {saved ? (
            <p role="status" className="flex items-start gap-2 text-sm font-medium text-(--success)">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Uloženo.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
