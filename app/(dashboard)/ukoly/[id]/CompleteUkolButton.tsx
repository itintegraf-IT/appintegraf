"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CompleteUkolButton({ id }: { id: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onComplete = async () => {
    if (!confirm("Potvrdit splnění úkolu? Úkol se přesune do archivu.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ukoly/${id}/complete`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === "string" ? data.error : "Nepodařilo se potvrdit splnění");
        setLoading(false);
        return;
      }
      router.push("/ukoly?completed=1");
      router.refresh();
    } catch {
      alert("Síťová chyba");
    }
    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={onComplete}
      disabled={loading}
      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
    >
      {loading ? "Potvrzuji…" : "Potvrdit splnění"}
    </button>
  );
}
