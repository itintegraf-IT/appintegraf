"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteMaketaButton({ id }: { id: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onDelete = async () => {
    if (!confirm("Opravdu smazat tuto maketu?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/makety/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === "string" ? data.error : "Smazání se nezdařilo");
        setLoading(false);
        return;
      }
      router.push("/makety");
      router.refresh();
    } catch {
      alert("Síťová chyba");
    }
    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={loading}
      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {loading ? "Mažu…" : "Smazat"}
    </button>
  );
}
