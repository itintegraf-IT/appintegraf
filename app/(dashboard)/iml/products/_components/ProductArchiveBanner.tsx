"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArchiveRestore } from "lucide-react";

/**
 * Banner + admin akce pro reaktivaci produktu z archivu.
 */
export function ProductArchiveBanner({
  productId,
  archivedAt,
  canAdmin,
}: {
  productId: number;
  archivedAt: string | Date;
  canAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [restoreToHot, setRestoreToHot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const archivedLabel = (() => {
    const d = new Date(archivedAt);
    return Number.isNaN(d.getTime()) ? String(archivedAt) : d.toLocaleDateString("cs-CZ");
  })();

  const reactivate = async () => {
    if (
      !confirm(
        restoreToHot
          ? "Reaktivovat produkt a zkopírovat PDF zpět do databáze (hot data)?"
          : "Reaktivovat produkt mezi aktivní data? PDF zůstane na disku (doporučeno)."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/iml/products/${productId}/reactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restoreToHot }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Reaktivace selhala");
        return;
      }
      router.refresh();
    } catch {
      setError("Reaktivace selhala");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">Produkt je v archivu</p>
          <p className="mt-1 text-sm text-amber-900/80">
            Tisková data byla přesunuta na disk ({archivedLabel}). Metadata zůstávají ve
            vyhledávání; výchozí seznam produktů archiv skrývá.
          </p>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
        {canAdmin && (
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={restoreToHot}
                onChange={(e) => setRestoreToHot(e.target.checked)}
                disabled={busy}
              />
              Obnovit PDF do DB (hot BLOB)
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={reactivate}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
            >
              <ArchiveRestore className="h-4 w-4" />
              {busy ? "Reaktivuji…" : "Reaktivovat"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
