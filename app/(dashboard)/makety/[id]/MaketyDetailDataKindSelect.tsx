"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  maketyDataKindLabel,
  type MaketyDataKind,
} from "@/lib/makety-data-kind";

type Props = {
  maketaId: number;
  initialDataKind: string;
};

export function MaketyDetailDataKindSelect({ maketaId, initialDataKind }: Props) {
  const router = useRouter();
  const [dataKind, setDataKind] = useState(initialDataKind);
  const [loading, setLoading] = useState(false);

  const onChange = async (next: MaketyDataKind) => {
    setDataKind(next);
    setLoading(true);
    try {
      const res = await fetch(`/api/makety/${maketaId}/data-kind`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data_kind: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(typeof data.error === "string" ? data.error : "Změna typu dat se nezdařila");
        setDataKind(initialDataKind);
      } else {
        router.refresh();
      }
    } catch {
      alert("Síťová chyba");
      setDataKind(initialDataKind);
    }
    setLoading(false);
  };

  return (
    <dd className="mt-1">
      <select
        value={dataKind}
        disabled={loading}
        onChange={(e) => onChange(e.target.value as MaketyDataKind)}
        className="rounded-lg border border-gray-300 px-2 py-1 text-sm font-medium disabled:opacity-50"
        aria-label="Typ dat"
      >
        <option value="nova_data">{maketyDataKindLabel("nova_data")}</option>
        <option value="uprava_dat">{maketyDataKindLabel("uprava_dat")}</option>
      </select>
    </dd>
  );
}
