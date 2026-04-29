"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function DeleteSharedMailButton({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onDelete = async () => {
    if (!confirm(`Opravdu smazat společný e-mail „${label}“? Přiřazení u uživatelů se zruší.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/shared-mails/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Smazání se nezdařilo");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={loading}
      className="rounded p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
      title="Smazat"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
