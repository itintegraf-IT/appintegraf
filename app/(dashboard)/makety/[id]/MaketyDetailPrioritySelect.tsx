"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  maketaPriorityBadgeClass,
  maketaPriorityLabel,
  type MaketaPriority,
} from "@/lib/makety-status";

type Props = {
  maketaId: number;
  initialPriority: string;
};

export function MaketyDetailPrioritySelect({ maketaId, initialPriority }: Props) {
  const router = useRouter();
  const [priority, setPriority] = useState(initialPriority);
  const [loading, setLoading] = useState(false);

  const onChange = async (next: MaketaPriority) => {
    setPriority(next);
    setLoading(true);
    try {
      const res = await fetch(`/api/makety/${maketaId}/priority`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(typeof data.error === "string" ? data.error : "Změna priority se nezdařila");
        setPriority(initialPriority);
      } else {
        router.refresh();
      }
    } catch {
      alert("Síťová chyba");
      setPriority(initialPriority);
    }
    setLoading(false);
  };

  return (
    <dd className="mt-1">
      <select
        value={priority}
        disabled={loading}
        onChange={(e) => onChange(e.target.value as MaketaPriority)}
        className={`rounded-lg border border-gray-300 px-2 py-1 text-sm font-medium disabled:opacity-50 ${maketaPriorityBadgeClass(priority)}`}
        aria-label="Priorita"
      >
        <option value="normal">{maketaPriorityLabel("normal")}</option>
        <option value="high">{maketaPriorityLabel("high")}</option>
        <option value="urgent">{maketaPriorityLabel("urgent")}</option>
      </select>
    </dd>
  );
}
