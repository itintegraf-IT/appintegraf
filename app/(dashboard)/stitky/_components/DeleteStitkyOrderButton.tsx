"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  orderId: number;
  orderNumber: string;
  isAdmin?: boolean;
  redirectTo?: string;
};

export function DeleteStitkyOrderButton({
  orderId,
  orderNumber,
  isAdmin = false,
  redirectTo = "/stitky",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onDelete = async () => {
    const msg = isAdmin
      ? `Opravdu trvale smazat zakázku „${orderNumber}"? Tuto akci nelze vrátit.`
      : `Opravdu smazat rozpracovanou zakázku „${orderNumber}"?`;
    if (!confirm(msg)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stitky/orders/${orderId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === "string" ? data.error : "Smazání se nezdařilo");
        setLoading(false);
        return;
      }
      router.push(redirectTo);
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
      {loading ? "Mažu…" : "Smazat zakázku"}
    </button>
  );
}
