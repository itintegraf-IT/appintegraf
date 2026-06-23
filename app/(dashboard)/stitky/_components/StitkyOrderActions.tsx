"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { downloadStitkyPdf } from "./download-stitky-pdf";

type Props = {
  orderId: number;
  rows: { rowIndex: number; hasData: boolean }[];
  canPrint: boolean;
  canComplete: boolean;
  layoutReady: boolean;
};

export function StitkyOrderActions({ orderId, rows, canPrint, canComplete, layoutReady }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pdfRow, setPdfRow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const complete = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/stitky/orders/${orderId}/complete`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async (rowIndex: number) => {
    setPdfRow(rowIndex);
    setError(null);
    try {
      await downloadStitkyPdf(orderId, rowIndex);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stažení PDF selhalo");
    } finally {
      setPdfRow(null);
    }
  };

  if (!canPrint && !canComplete) return null;

  const activeRows = rows.filter((r) => r.hasData);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="mb-3 font-semibold text-gray-900">Tisk a zpracování</h2>
      {!layoutReady && (
        <p className="mb-3 text-sm text-amber-700">
          Šablona zakázky zatím nemá dokončený layout — náhled, PDF a tisk nejsou k dispozici.
        </p>
      )}
      {error && (
        <p className="mb-3 text-sm text-red-700">{error}</p>
      )}
      <div className="space-y-3">
        {canPrint &&
          layoutReady &&
          activeRows.map((r) => (
            <div key={r.rowIndex} className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-sm text-gray-600">Řádek {r.rowIndex}:</span>
              <Link
                href={`/stitky/${orderId}/preview/${r.rowIndex}`}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Náhled / tisk
              </Link>
              <button
                type="button"
                onClick={() => downloadPdf(r.rowIndex)}
                disabled={pdfRow !== null}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {pdfRow === r.rowIndex ? "Generuji PDF…" : "PDF"}
              </button>
            </div>
          ))}
        {canComplete && (
          <button
            type="button"
            onClick={complete}
            disabled={busy}
            className="rounded-lg bg-green-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            Zpracováno
          </button>
        )}
      </div>
    </div>
  );
}
