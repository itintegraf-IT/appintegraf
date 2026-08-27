"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eraser, Loader2 } from "lucide-react";
import { imlItemStatusLabel } from "@/lib/iml-constants";

type StatusCounts = { products: number; withAssets: number };

type Status = {
  allowedStatuses: string[];
  byStatus: Record<string, StatusCounts>;
  productsInStatus: number;
  productsWithAssets: number;
};

type RunResult = {
  dryRun: boolean;
  allowedStatuses: string[];
  selectedStatuses: string[];
  candidateIds: number[];
  processed: Array<{
    productId: number;
    filesDeleted: number;
    clearedImage: boolean;
    clearedLegacyPdf: boolean;
    bytesFreed: number;
    skippedReason?: string;
  }>;
  totalBytesFreed: number;
  totalFilesDeleted: number;
};

export function ImlWipePrintAssetsTab() {
  const [status, setStatus] = useState<Status | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RunResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/iml/products/wipe-assets");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba načtení");
      const next = data as Status;
      setStatus(next);
      setSelected((prev) => {
        if (prev.length > 0) {
          return next.allowedStatuses.filter((s) => prev.includes(s));
        }
        return [...next.allowedStatuses];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba načtení");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedStats = useMemo(() => {
    if (!status) return { products: 0, withAssets: 0 };
    return selected.reduce(
      (acc, s) => {
        const row = status.byStatus[s];
        if (!row) return acc;
        return {
          products: acc.products + row.products,
          withAssets: acc.withAssets + row.withAssets,
        };
      },
      { products: 0, withAssets: 0 }
    );
  }, [status, selected]);

  const toggleStatus = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  };

  const run = async (dryRun: boolean) => {
    if (selected.length === 0) {
      setError("Vyberte alespoň jeden stav položky.");
      return;
    }
    if (
      !dryRun &&
      !confirm(
        `Opravdu smazat tisková PDF a softproof u dávky produktů ve stavu: ${selected.join(", ")}? Tuto akci nelze vrátit zpět (metadata produktů zůstanou).`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/iml/products/wipe-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, limit: 20, statuses: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Běh selhal");
      setLastResult(data as RunResult);
      if (!dryRun) await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Běh selhal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Eraser className="h-5 w-5 text-red-600" />
          Mazání tiskových dat a softproofů
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Smaže všechna tisková PDF (včetně verzí a souborů na disku) a softproof
          náhled (
          <code className="rounded bg-gray-100 px-1">image_data</code>). Samotný
          produkt a metadata (kód, zákazník, stav, barvy…) zůstanou. Označte
          stavy, kterých se má dávka týkat.
        </p>
        <p className="mt-2 text-sm text-amber-800">
          Aktivní, archivní, testovací a rozpracované produkty se dávky{" "}
          <strong>nedotknou</strong> — nelze je ani zaškrtnout.
        </p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Načítání…
        </p>
      ) : status ? (
        <>
          <fieldset className="rounded-lg border border-gray-200 bg-white p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
              Stavy k mazání
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {status.allowedStatuses.map((s) => {
                const counts = status.byStatus[s] ?? {
                  products: 0,
                  withAssets: 0,
                };
                return (
                  <label
                    key={s}
                    className="flex cursor-pointer items-start gap-2 text-sm text-gray-900"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selected.includes(s)}
                      onChange={() => toggleStatus(s)}
                      disabled={busy}
                    />
                    <span>
                      <span className="font-medium">{imlItemStatusLabel(s)}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        {counts.products} produktů · {counts.withAssets} se
                        soubory
                      </span>
                      <Link
                        href={`/iml/products?status=${encodeURIComponent(s)}`}
                        className="ml-2 text-xs text-red-700 underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        seznam
                      </Link>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Vybrané stavy
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                <strong>{selectedStats.products}</strong> produktů
              </dd>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-amber-800">
                Ke smazání souborů
              </dt>
              <dd className="mt-1 text-sm text-amber-950">
                <strong>{selectedStats.withAssets}</strong> produktů má tisková
                data nebo softproof
              </dd>
            </div>
          </dl>
        </>
      ) : null}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || selected.length === 0}
          onClick={() => void run(true)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
        >
          {busy ? "Běží…" : "Dry-run (náhled dávky)"}
        </button>
        <button
          type="button"
          disabled={busy || selected.length === 0}
          onClick={() => void run(false)}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
        >
          Smazat dávku (max 20)
        </button>
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => void load()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Obnovit stav
        </button>
      </div>

      {lastResult && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
          <p className="font-medium text-gray-900">
            {lastResult.dryRun ? "Dry-run" : "Hotovo"} — stavy:{" "}
            {(lastResult.selectedStatuses ?? []).join(", ")} — kandidátů:{" "}
            {lastResult.candidateIds.length}
            {!lastResult.dryRun && (
              <>
                {" "}
                · smazáno verzí PDF: {lastResult.totalFilesDeleted}
                {" · "}
                uvolněno ≈{" "}
                {Math.round(lastResult.totalBytesFreed / (1024 * 1024))} MB
              </>
            )}
          </p>
          {lastResult.candidateIds.length > 0 && (
            <p className="mt-2 font-mono text-xs text-gray-600">
              ID: {lastResult.candidateIds.join(", ")}
            </p>
          )}
          {!lastResult.dryRun && lastResult.processed.length > 0 && (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-gray-600">
              {lastResult.processed.map((p) => (
                <li key={p.productId}>
                  #{p.productId}: PDF verzí {p.filesDeleted}
                  {p.clearedImage ? " + softproof" : ""}
                  {p.clearedLegacyPdf ? " + legacy PDF" : ""}
                  {p.skippedReason ? ` (${p.skippedReason})` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
