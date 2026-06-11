"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  maketaId: number;
  rejectionReason?: string | null;
};

export function MaketaQuoteForm({ maketaId, rejectionReason }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/makety/${maketaId}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_price: fd.get("quote_price"),
          quote_production_description: fd.get("quote_production_description"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Odeslání se nezdařilo");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Síťová chyba");
    }
    setLoading(false);
  };

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
      <h3 className="text-sm font-semibold text-sky-900">Kalkulace pro zadavatele</h3>
      <p className="mt-1 text-sm text-sky-800">
        Vyplňte cenu a popis výroby. Po odeslání zadavatel nabídku schválí nebo zamítne.
      </p>
      {rejectionReason && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="font-medium">Důvod vrácení k přepočtu:</span> {rejectionReason}
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Cena (Kč)</label>
          <input
            name="quote_price"
            type="number"
            min="0"
            step="0.01"
            required
            className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="např. 1500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Popis výroby</label>
          <textarea
            name="quote_production_description"
            required
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Materiál, postup, poznámky k výrobě…"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {loading ? "Odesílám…" : "Odeslat zadavateli"}
        </button>
      </form>
    </div>
  );
}
