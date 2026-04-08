"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartUkolButton({ id }: { id: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onStart = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ukoly/${id}/start`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === "string" ? data.error : "Nepodařilo se potvrdit rozpracování");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      alert("Síťová chyba");
    }
    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={onStart}
      disabled={loading}
      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
    >
      {loading ? "Potvrzuji…" : "Potvrdit rozpracování"}
    </button>
  );
}
