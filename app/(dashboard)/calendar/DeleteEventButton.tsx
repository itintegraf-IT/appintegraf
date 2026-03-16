"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

type Props = {
  eventId: number;
  eventTitle: string;
};

export function DeleteEventButton({ eventId, eventTitle }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar/${eventId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chyba při mazání");
      router.push("/calendar");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při mazání");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
        Smazat
      </button>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Smazat událost</h3>
            <p className="mt-2 text-sm text-gray-600">
              Opravdu chcete smazat událost „{eventTitle}“? Tato akce je nevratná.
            </p>
            <p className="mt-2 text-sm text-amber-700">
              Pokud byla událost schválena, schvalovatelé obdrží notifikaci o smazání.
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setError(null);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Mažu…" : "Smazat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
