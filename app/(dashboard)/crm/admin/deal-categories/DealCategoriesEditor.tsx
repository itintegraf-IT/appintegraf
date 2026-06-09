"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Category = {
  id: string;
  code: string;
  label: string;
  color: string;
  active: boolean;
  sort_order: number;
};

export function DealCategoriesEditor({ initialCategories }: { initialCategories: Category[] }) {
  const [cats, setCats] = useState(initialCategories);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#2A9D8F");
  const [sortOrder, setSortOrder] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/crm/admin/deal-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, label, color, sortOrder }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Chyba");
      return;
    }
    const data = (await res.json()) as { category: Category };
    setCats((prev) => [...prev, data.category]);
    setCode("");
    setLabel("");
    setColor("#2A9D8F");
    setSortOrder(50);
    setError(null);
    router.refresh();
  }

  async function toggleActive(c: Category) {
    const res = await fetch(`/api/crm/admin/deal-categories/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    if (res.ok) {
      setCats((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: !c.active } : x)));
    }
  }

  async function remove(c: Category) {
    if (!window.confirm(`Smazat "${c.label}"?`)) return;
    const res = await fetch(`/api/crm/admin/deal-categories/${c.id}`, { method: "DELETE" });
    if (res.ok) setCats((prev) => prev.filter((x) => x.id !== c.id));
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <Label htmlFor="dc-code">Kód</Label>
          <Input
            id="dc-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            className="w-28"
          />
        </div>
        <div className="grid min-w-56 flex-1 gap-1">
          <Label htmlFor="dc-label">Název</Label>
          <Input id="dc-label" value={label} onChange={(e) => setLabel(e.target.value)} required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="dc-color">Barva</Label>
          <input
            id="dc-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-14 rounded border"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="dc-sortOrder">Pořadí</Label>
          <Input
            id="dc-sortOrder"
            type="number"
            min={0}
            max={9999}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="w-24"
          />
        </div>
        <Button type="submit">Přidat</Button>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </form>
      <ul className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {cats.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-4 py-2">
            <Checkbox id={`dc-${c.id}`} checked={c.active} onCheckedChange={() => toggleActive(c)} />
            <span
              className="inline-block size-4 shrink-0 rounded-full"
              style={{ backgroundColor: c.color }}
            />
            <Label htmlFor={`dc-${c.id}`} className="flex-1">
              <span className="font-mono text-xs text-gray-500">{c.code}</span> · {c.label}
              <span className="ml-2 text-xs text-gray-500">#{c.sort_order}</span>
            </Label>
            <Button variant="ghost" size="sm" onClick={() => remove(c)}>
              Smazat
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
