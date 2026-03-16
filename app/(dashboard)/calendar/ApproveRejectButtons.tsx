"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

type Props = {
  eventId: number;
  eventTitle: string;
};

export function ApproveRejectButtons({ eventId, eventTitle }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setLoading("approve");
    setError(null);
    try {
      const res = await fetch(`/api/calendar/${eventId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chyba při schválení");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při schválení");
    } finally {
      setLoading(null);
    }
  };

  const handleRejectSubmit = async () => {
    const reason = rejectReason.trim();
    if (!reason) {
      setError("Důvod zamítnutí je povinný");
      return;
    }
    setLoading("reject");
    setError(null);
    try {
      const res = await fetch(`/api/calendar/${eventId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", comment: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chyba při zamítnutí");
      setRejectModalOpen(false);
      setRejectReason("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při zamítnutí");
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={!!loading}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {loading === "approve" ? "Schvaluji…" : "Schválit"}
        </button>
        <button
          type="button"
          onClick={() => setRejectModalOpen(true)}
          disabled={!!loading}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          Zamítnout
        </button>
      </div>

      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Zamítnout událost</h3>
            <p className="mt-2 text-sm text-gray-600">
              Událost „{eventTitle}“ bude zamítnuta. Důvod bude odeslán žadateli.
            </p>
            <label className="mt-4 block text-sm font-medium text-gray-700">
              Důvod zamítnutí *
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Zadejte důvod zamítnutí…"
              rows={4}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectReason("");
                  setError(null);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={loading === "reject"}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading === "reject" ? "Odesílám…" : "Zamítnout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
