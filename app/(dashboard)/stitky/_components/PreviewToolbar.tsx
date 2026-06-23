"use client";

import Link from "next/link";
import { useState } from "react";
import { downloadStitkyPdf } from "./download-stitky-pdf";

type Props = {
  orderId: number;
  rowIndex: number;
  backHref: string;
};

export function PreviewToolbar({ orderId, rowIndex, backHref }: Props) {
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await fetch(`/api/stitky/orders/${orderId}/print/${rowIndex}`, { method: "POST" });
      window.print();
    } finally {
      setPrinting(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadStitkyPdf(orderId, rowIndex);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stažení PDF selhalo");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="stitky-no-print mb-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="text-sm text-red-700 hover:underline">
          ← Zpět na zakázku
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading || printing}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {downloading ? "Generuji PDF…" : "Stáhnout PDF"}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={printing || downloading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {printing ? "Příprava…" : "Tisknout"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
