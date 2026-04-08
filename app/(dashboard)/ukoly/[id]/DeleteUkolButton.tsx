"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteUkolButton({ id }: { id: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onDelete = async () => {
    if (!confirm("Opravdu smazat tento úkol?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ukoly/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(typeof d.error === "string" ? d.error : "Smazání se nezdařilo");
        setLoading(false);
        return;
      }
      router.push("/ukoly");
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
      className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      Smazat úkol
    </button>
  );
}
