"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";

type Props = {
  maketaId: number;
};

export function ForceClaimOwnershipButton({ maketaId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onClaim = async () => {
    if (loading) return;
    if (
      !confirm(
        "Nucené přebrání: převezmete řízení této zakázky na sebe a stanete se zadavatelem. Pokračovat?"
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/makety/${maketaId}/transfer-ownership`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceClaim: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(
          typeof data.error === "string" ? data.error : "Nucené přebrání se nezdařilo"
        );
        return;
      }
      router.refresh();
    } catch {
      alert("Síťová chyba");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClaim}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
    >
      <ShieldAlert className="h-4 w-4" />
      {loading ? "Přebírám…" : "Nucené přebrání"}
    </button>
  );
}
