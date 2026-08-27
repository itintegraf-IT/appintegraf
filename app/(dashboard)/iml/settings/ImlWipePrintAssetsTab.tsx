"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eraser, Loader2 } from "lucide-react";

type Status = {
  allowedStatuses: string[];
  productsInStatus: number;
  productsWithAssets: number;
};

type RunResult = {
  dryRun: boolean;
  allowedStatuses: string[];
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
      setStatus(data as Status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba načtení");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (dryRun: boolean) => {
    if (
      !dryRun &&
      !confirm(
        "Opravdu smazat tisková PDF a softproof u dávky produktů ve stavu zablokovaná / chyba? Tuto akci nelze vrátit zpět (metadata produktů zůstanou)."
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
        body: JSON.stringify({ dryRun, limit: 20 }),
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

  const statusLabel =
    status?.allowedStatuses?.map((s) => s).join(", ") ?? "zablokovaná, chyba";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Eraser className="h-5 w-5 text-red-600" />
          Mazání tiskových dat a softproofů
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          U produktů ve stavu <strong>{statusLabel}</strong> smaže všechna
          tisková PDF (včetně verzí a souborů na disku) a softproof náhled (
          <code className="rounded bg-gray-100 px-1">image_data</code>). Samotný
          produkt a metadata (kód, zákazník, stav, barvy…) zůstanou.
        </p>
        <p className="mt-2 text-sm text-amber-800">
          Aktivní, archivní, testovací a rozpracované produkty se dávky{" "}
          <strong>nedotknou</strong>.
        </p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Načítání…
        </p>
      ) : status ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Produkty ve stavu
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              <strong>{status.productsInStatus}</strong> produktů (
              {statusLabel})
            </dd>
            <dd className="mt-2 text-xs text-gray-500">
              Filtr:{" "}
              <Link
                href="/iml/products?status=zablokovaná"
                className="text-red-700 underline"
              >
                zablokovaná
              </Link>
              {" · "}
              <Link
                href="/iml/products?status=chyba"
                className="text-red-700 underline"
              >
                chyba
              </Link>
            </dd>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-amber-800">
              Ke smazání souborů
            </dt>
            <dd className="mt-1 text-sm text-amber-950">
              <strong>{status.productsWithAssets}</strong> produktů má tisková
              data nebo softproof
            </dd>
          </div>
        </dl>
      ) : null}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(true)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
        >
          {busy ? "Běží…" : "Dry-run (náhled dávky)"}
        </button>
        <button
          type="button"
          disabled={busy}
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
            {lastResult.dryRun ? "Dry-run" : "Hotovo"} — kandidátů:{" "}
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
