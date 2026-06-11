"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  maketaId: number;
  quotePrice: string;
  quoteProductionDescription: string;
};

export function MaketaApprovalPanel({
  maketaId,
  quotePrice,
  quoteProductionDescription,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectMode, setRejectMode] = useState<"rework" | "cancel">("rework");
  const [reason, setReason] = useState("");

  const onApprove = async () => {
    setError(null);
    setLoading("approve");
    try {
      const res = await fetch(`/api/makety/${maketaId}/approve`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Schválení se nezdařilo");
        setLoading(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Síťová chyba");
    }
    setLoading(null);
  };

  const onReject = async () => {
    setError(null);
    setLoading("reject");
    try {
      const res = await fetch(`/api/makety/${maketaId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: rejectMode, reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Zamítnutí se nezdařilo");
        setLoading(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Síťová chyba");
    }
    setLoading(null);
  };

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
      <h3 className="text-sm font-semibold text-indigo-900">Schválení nabídky výrobce</h3>
      <dl className="mt-3 grid gap-2 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase text-indigo-700">Cena</dt>
          <dd className="font-medium text-indigo-950">{quotePrice}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-indigo-700">Popis výroby</dt>
          <dd className="whitespace-pre-wrap text-indigo-950">{quoteProductionDescription}</dd>
        </div>
      </dl>

      {!showReject ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={loading !== null}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading === "approve" ? "Schvaluji…" : "Schválit do výroby"}
          </button>
          <button
            type="button"
            onClick={() => setShowReject(true)}
            disabled={loading !== null}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Zamítnout
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3 rounded-lg border border-indigo-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-800">Zamítnutí nabídky</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="rejectMode"
                checked={rejectMode === "rework"}
                onChange={() => setRejectMode("rework")}
              />
              Vrátit k přepočtu
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="rejectMode"
                checked={rejectMode === "cancel"}
                onChange={() => setRejectMode("cancel")}
              />
              Zrušit zakázku
            </label>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Důvod zamítnutí (volitelné)"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onReject}
              disabled={loading !== null}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading === "reject" ? "Ukládám…" : "Potvrdit zamítnutí"}
            </button>
            <button
              type="button"
              onClick={() => setShowReject(false)}
              disabled={loading !== null}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Zpět
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
