"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Archive, Loader2 } from "lucide-react";

type Status = {
  archiveRoot: string;
  archiveRootFromEnv: boolean;
  inactiveMonths: number;
  archivedProducts: number;
  productsWithHotPdf: number;
};

type RunResult = {
  dryRun: boolean;
  inactiveMonths: number;
  candidateIds: number[];
  processed: Array<{
    productId: number;
    filesArchived: number;
    legacyArchived: boolean;
    bytesFreed: number;
    skippedReason?: string;
  }>;
  totalBytesFreed: number;
};

export function ImlProductArchiveTab() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RunResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/iml/products/archive");
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
        "Opravdu archivovat dávku produktů? PDF se přesunou z databáze na disk a produkt se označí jako archivovaný."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/iml/products/archive", {
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Archive className="h-5 w-5 text-red-600" />
          Archiv tiskových dat produktů
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Neaktivní produkty (výchozí {status?.inactiveMonths ?? 6} měsíců) mají PDF přesunutá z
          MySQL na disk. Metadata zůstávají ve vyhledávání; reaktivace je na detailu produktu
          (admin).
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
              Složka archivu
            </dt>
            <dd className="mt-1 break-all font-mono text-sm text-gray-900">
              {status.archiveRoot}
            </dd>
            <dd className="mt-1 text-xs text-gray-500">
              {status.archiveRootFromEnv
                ? "Nastaveno přes IML_ARCHIVE_DIR v .env serveru"
                : "Výchozí relativní cesta (storage/iml-archive). Pro produkci nastavte IML_ARCHIVE_DIR."}
            </dd>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Stav</dt>
            <dd className="mt-1 text-sm text-gray-900">
              Archivováno: <strong>{status.archivedProducts}</strong> produktů
            </dd>
            <dd className="mt-1 text-sm text-gray-700">
              Aktivní s PDF ještě v DB: <strong>{status.productsWithHotPdf}</strong>
            </dd>
            <dd className="mt-2 text-xs text-gray-500">
              Seznam:{" "}
              <Link href="/iml/products?archive=archived" className="text-red-700 underline">
                jen archiv
              </Link>
            </dd>
          </div>
        </dl>
      ) : null}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => run(true)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
        >
          {busy ? "Běží…" : "Dry-run (náhled dávky)"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(false)}
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
        >
          Archivovat dávku (max 20)
        </button>
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => load()}
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
                · uvolněno ≈ {Math.round(lastResult.totalBytesFreed / (1024 * 1024))} MB
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
                  #{p.productId}: souborů {p.filesArchived}
                  {p.legacyArchived ? " + legacy" : ""}
                  {p.skippedReason ? ` (${p.skippedReason})` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500">
        Automatický běh: cron{" "}
        <code className="rounded bg-gray-100 px-1">POST /api/cron/iml-product-archive</code> s{" "}
        <code className="rounded bg-gray-100 px-1">CRON_SECRET</code>. Složku zařaďte do záloh
        serveru.
      </p>
    </div>
  );
}
