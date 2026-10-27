"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { UserRoundCog } from "lucide-react";

export type TransferOwnerCandidate = {
  id: number;
  first_name: string;
  last_name: string;
};

type Props = {
  maketaId: number;
  currentOwnerId: number;
  candidates: TransferOwnerCandidate[];
};

export function TransferOwnershipButton({
  maketaId,
  currentOwnerId,
  candidates,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const options = useMemo(
    () => candidates.filter((u) => u.id !== currentOwnerId),
    [candidates, currentOwnerId]
  );

  const close = () => {
    if (loading) return;
    setOpen(false);
    setSelectedId("");
    setError("");
  };

  const onSubmit = async () => {
    const newOwnerUserId = parseInt(selectedId, 10);
    if (!Number.isFinite(newOwnerUserId) || newOwnerUserId <= 0) {
      setError("Vyberte uživatele.");
      return;
    }
    const picked = options.find((u) => u.id === newOwnerUserId);
    if (
      !confirm(
        `Předat řízení zakázky uživateli ${picked?.first_name ?? ""} ${picked?.last_name ?? ""}? Stane se novým zadavatelem (úprava / mazání).`
      )
    ) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/makety/${maketaId}/transfer-ownership`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerUserId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Předání se nezdařilo"
        );
        return;
      }
      setOpen(false);
      setSelectedId("");
      router.refresh();
    } catch {
      setError("Síťová chyba");
    } finally {
      setLoading(false);
    }
  };

  if (options.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-violet-300 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50"
      >
        <UserRoundCog className="h-4 w-4" />
        Předat řízení
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900">Předat řízení</h3>
            <p className="mt-1 text-sm text-gray-600">
              Nový zadavatel získá kompletní řízení zakázky (úprava, mazání). Grafik a
              schvalovatelé zůstávají beze změny.
            </p>

            <label className="mt-4 block text-sm font-medium text-gray-700">
              Nový zadavatel
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={loading}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— vyberte —</option>
                {options.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.last_name} {u.first_name}
                  </option>
                ))}
              </select>
            </label>

            {error && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={loading}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={loading || !selectedId}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {loading ? "Předávám…" : "Předat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
