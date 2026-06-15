"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ImageIcon, Loader2 } from "lucide-react";

const BATCH_LIMIT = 50;

type BackfillStatus = {
  remaining: number;
  canvasAvailable: boolean;
};

type BatchResult = {
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  remaining: number;
  errors: string[];
};

export function ImlThumbnailBackfillTab() {
  const [status, setStatus] = useState<BackfillStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [running, setRunning] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [totalCreated, setTotalCreated] = useState(0);
  const [lastBatch, setLastBatch] = useState<BatchResult | null>(null);
  const [recentErrors, setRecentErrors] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError("");
    try {
      const res = await fetch("/api/iml/products/thumbnails/backfill");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Chyba při načtení stavu");
      }
      setStatus({
        remaining: (data.remaining as number) ?? 0,
        canvasAvailable: Boolean(data.canvasAvailable),
      });
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Chyba při načtení stavu");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const runOneBatch = async (signal?: AbortSignal): Promise<BatchResult | null> => {
    const res = await fetch(
      `/api/iml/products/thumbnails/backfill?limit=${BATCH_LIMIT}`,
      { method: "POST", signal }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Chyba při generování miniatur");
    }
    return {
      processed: (data.processed as number) ?? 0,
      created: (data.created as number) ?? 0,
      skipped: (data.skipped as number) ?? 0,
      failed: (data.failed as number) ?? 0,
      remaining: (data.remaining as number) ?? 0,
      errors: (data.errors as string[]) ?? [],
    };
  };

  const handleSingleBatch = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunning(true);
    setAutoRunning(false);
    setLastBatch(null);
    try {
      const result = await runOneBatch(controller.signal);
      if (!result) return;
      setLastBatch(result);
      setTotalCreated(result.created);
      setBatchIndex(1);
      if (result.errors.length) {
        setRecentErrors(result.errors.slice(0, 10));
      }
      setStatus((s) => (s ? { ...s, remaining: result.remaining } : s));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setStatusError(e instanceof Error ? e.message : "Chyba při generování");
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const handleRunAll = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunning(true);
    setAutoRunning(true);
    setStatusError("");
    setRecentErrors([]);
    setTotalCreated(0);
    setBatchIndex(0);

    let createdSum = 0;
    let round = 0;

    try {
      while (!controller.signal.aborted) {
        round++;
        setBatchIndex(round);
        const result = await runOneBatch(controller.signal);
        if (!result) break;

        createdSum += result.created;
        setTotalCreated(createdSum);
        setLastBatch(result);
        setStatus((s) => (s ? { ...s, remaining: result.remaining } : s));

        if (result.errors.length) {
          setRecentErrors((prev) => [...result.errors, ...prev].slice(0, 10));
        }

        if (result.remaining <= 0 || result.processed === 0) break;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setStatusError(e instanceof Error ? e.message : "Chyba při generování");
    } finally {
      setRunning(false);
      setAutoRunning(false);
      abortRef.current = null;
      void loadStatus();
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    setAutoRunning(false);
  };

  return (
    <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <ImageIcon className="h-5 w-5 text-red-600" />
          Miniatury produktů z PDF
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Vygeneruje malé JPEG náhledy (1. stránka PDF) do databáze pro rychlé zobrazení v seznamu
          produktů. Existující vlastní náhledy se nepřepisují.
        </p>
      </div>

      {statusLoading ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Načítám stav…
        </p>
      ) : status ? (
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-800">
          <p>
            <strong>{status.remaining}</strong>{" "}
            {status.remaining === 1
              ? "produkt čeká"
              : status.remaining < 5
                ? "produkty čekají"
                : "produktů čeká"}{" "}
            na miniaturu (má PDF, chybí obrázek).
          </p>
        </div>
      ) : null}

      {status && !status.canvasAvailable && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Na serveru není dostupný balíček <code className="text-xs">canvas</code> – konverze PDF
            na JPEG nebude fungovat. Nainstalujte závislost a restartujte aplikaci (PM2).
          </p>
        </div>
      )}

      {statusError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {statusError}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleSingleBatch()}
          disabled={running || statusLoading || (status?.remaining ?? 0) === 0}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {running && !autoRunning ? "Generuji…" : `Spustit jednu dávku (${BATCH_LIMIT})`}
        </button>
        <button
          type="button"
          onClick={() => void handleRunAll()}
          disabled={running || statusLoading || (status?.remaining ?? 0) === 0}
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
        >
          {autoRunning ? "Generuji vše…" : "Spustit vše"}
        </button>
        {running && (
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </button>
        )}
        <button
          type="button"
          onClick={() => void loadStatus()}
          disabled={statusLoading || running}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Obnovit stav
        </button>
      </div>

      {running && autoRunning && (
        <p className="text-sm text-gray-600">
          Dávka {batchIndex} · celkem vytvořeno {totalCreated}
          {status != null ? ` · zbývá ~${status.remaining}` : ""}
          <span className="mt-1 block text-xs text-gray-500">
            Nechte kartu prohlížeče otevřenou, dokud běh neskončí.
          </span>
        </p>
      )}

      {lastBatch && !autoRunning && (
        <p className="text-sm text-gray-600">
          Poslední dávka: zpracováno {lastBatch.processed}, vytvořeno {lastBatch.created},
          přeskočeno {lastBatch.skipped}, chyb {lastBatch.failed}, zbývá {lastBatch.remaining}.
        </p>
      )}

      {recentErrors.length > 0 && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Upozornění z posledních dávek:</p>
          <ul className="mt-2 max-h-32 list-inside list-disc overflow-y-auto text-xs">
            {recentErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
