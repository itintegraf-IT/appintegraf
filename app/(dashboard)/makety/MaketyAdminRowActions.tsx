"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { type MaketaPriority } from "@/lib/makety-status";

type Props = {
  id: number;
  priority: string;
  status: string;
  /** Zobrazit dropdown priority (aktivní zakázky). */
  showPriority?: boolean;
};

export function MaketyAdminRowActions({ id, priority, status, showPriority = true }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [prio, setPrio] = useState(priority);
  const isActive = status === "open" || status === "in_progress";
  const canChangePriority = showPriority && isActive;

  const onPriorityChange = async (next: MaketaPriority) => {
    setPrio(next);
    setLoading(true);
    try {
      const res = await fetch(`/api/makety/${id}/priority`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(typeof data.error === "string" ? data.error : "Změna priority se nezdařila");
        setPrio(priority);
      } else {
        router.refresh();
      }
    } catch {
      alert("Síťová chyba");
      setPrio(priority);
    }
    setLoading(false);
  };

  const onDelete = async () => {
    if (!confirm("Opravdu trvale smazat tuto zakázku? Tuto akci nelze vrátit.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/makety/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === "string" ? data.error : "Smazání se nezdařilo");
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
    <div className="flex flex-wrap items-center gap-2">
      {canChangePriority && (
        <select
          value={prio}
          disabled={loading}
          onChange={(e) => onPriorityChange(e.target.value as MaketaPriority)}
          className="rounded-lg border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
          aria-label="Priorita"
        >
          <option value="normal">Normální</option>
          <option value="high">Vysoká</option>
          <option value="urgent">Urgentní</option>
        </select>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={loading}
        className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
      >
        {loading ? "…" : "Smazat"}
      </button>
    </div>
  );
}
