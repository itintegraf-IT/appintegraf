"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteResourceReservationButton({
  reservationId,
  canDelete,
}: {
  reservationId: number;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!canDelete) return null;

  const handleDelete = async () => {
    if (!confirm("Zrušit tuto rezervaci?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar/reservations/${reservationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Smazání se nezdařilo");
        return;
      }
      router.push("/calendar/resources/vehicles");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {loading ? "Ruším…" : "Zrušit rezervaci"}
    </button>
  );
}
