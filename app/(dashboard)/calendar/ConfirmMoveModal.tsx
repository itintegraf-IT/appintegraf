"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  eventId: number;
  eventTitle: string;
  newStart: Date;
  newEnd: Date;
  allDay: boolean;
  requiresApproval: boolean;
  onClose: () => void;
};

export function ConfirmMoveModal({
  eventId,
  eventTitle,
  newStart,
  newEnd,
  allDay,
  requiresApproval,
  onClose,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (d: Date) =>
    d.toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" });
  const formatTime = (d: Date) =>
    d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const startStr = newStart.toISOString();
      const endStr = newEnd.toISOString();
      const res = await fetch(`/api/calendar/${eventId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: startStr,
          end_date: endStr,
          all_day: allDay,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chyba při přesunu");
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při přesunu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900">Potvrdit přesunutí</h3>
        <p className="mt-2 text-sm text-gray-600">
          Přesunout událost „{eventTitle}“ na nové datum?
        </p>
        <p className="mt-2 font-medium text-gray-900">
          {allDay
            ? `${formatDate(newStart)} (celý den)`
            : `${formatDate(newStart)} ${formatTime(newStart)} – ${formatTime(newEnd)}`}
        </p>
        {requiresApproval && (
          <p className="mt-2 text-sm text-amber-700">
            Událost vyžaduje schválení. Po přesunu bude znovu čekat na schválení zástupem.
          </p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Přesouvám…" : "Potvrdit"}
          </button>
        </div>
      </div>
    </div>
  );
}
