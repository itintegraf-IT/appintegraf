"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Reason = { id: string; code: string; label: string; active: boolean };

export function LostReasonsEditor({ initialReasons }: { initialReasons: Reason[] }) {
  const [reasons, setReasons] = useState(initialReasons);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/crm/admin/lost-reasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, label }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Chyba");
      return;
    }
    const data = (await res.json()) as { reason: Reason };
    setReasons((r) => [...r, data.reason]);
    setCode("");
    setLabel("");
    setError(null);
    router.refresh();
  }

  async function toggleActive(r: Reason) {
    const res = await fetch(`/api/crm/admin/lost-reasons/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !r.active }),
    });
    if (res.ok) {
      setReasons((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: !r.active } : x)));
    }
  }

  async function remove(r: Reason) {
    if (!window.confirm(`Smazat "${r.label}"?`)) return;
    const res = await fetch(`/api/crm/admin/lost-reasons/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      setReasons((prev) => prev.filter((x) => x.id !== r.id));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <Label htmlFor="lr-code">Kód</Label>
          <Input id="lr-code" value={code} onChange={(e) => setCode(e.target.value)} required className="w-32" />
        </div>
        <div className="grid min-w-64 flex-1 gap-1">
          <Label htmlFor="lr-label">Popis</Label>
          <Input id="lr-label" value={label} onChange={(e) => setLabel(e.target.value)} required />
        </div>
        <Button type="submit">Přidat</Button>
      </form>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <ul className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {reasons.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-2">
            <Checkbox id={`lr-${r.id}`} checked={r.active} onCheckedChange={() => toggleActive(r)} />
            <Label htmlFor={`lr-${r.id}`} className="flex-1">
              <span className="font-mono text-xs text-gray-500">{r.code}</span> · {r.label}
            </Label>
            <Button variant="ghost" size="sm" onClick={() => remove(r)}>
              Smazat
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
