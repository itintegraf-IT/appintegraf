"use client";

import { useEffect, useState } from "react";

type Item = {
  id: number;
  productId: number;
  label: string;
};

type ShapeOpt = { id: number; shape_code: string; width_mm: string | number; height_mm: string | number };

export function BulkAssignShape({
  orderId,
  items,
}: {
  orderId: number;
  items: Item[];
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [shapes, setShapes] = useState<ShapeOpt[]>([]);
  const [shapeId, setShapeId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/iml/shapes")
      .then((r) => r.json())
      .then((d) => setShapes(d.shapes ?? []))
      .catch(() => setShapes([]));
  }, []);

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allChecked = items.length > 0 && selected.length === items.length;

  const run = async () => {
    setLoading(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/iml/orders/${orderId}/bulk-assign-shape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shape_id: Number(shapeId),
          item_ids: selected,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Přiřazení selhalo");
        return;
      }
      setMsg(
        `Přiřazeno tvaru ${data.updatedProducts} produktům (nástroj #${data.toolId ?? "—"}, montáž #${data.impositionId ?? "—"}). Obnovte stránku.`
      );
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
      <h2 className="text-sm font-semibold text-gray-900">
        Přiřadit tvar a výsek vybraným položkám
      </h2>
      <p className="mt-1 text-xs text-gray-600">
        Zvolí tvar, PRIMARY nástroj a výchozí montáž u všech označených produktů.
      </p>

      <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 text-sm">
        <label className="mb-2 flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={() =>
              setSelected(allChecked ? [] : items.map((i) => i.id))
            }
          />
          Všechny položky
        </label>
        {items.map((it) => (
          <label key={it.id} className="flex items-center gap-2 py-0.5">
            <input
              type="checkbox"
              checked={selected.includes(it.id)}
              onChange={() => toggle(it.id)}
            />
            <span className="truncate">{it.label}</span>
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Tvar</span>
          <select
            className="min-w-[16rem] rounded-lg border border-gray-300 px-3 py-2"
            value={shapeId}
            onChange={(e) => setShapeId(e.target.value)}
          >
            <option value="">— Vyberte —</option>
            {shapes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.shape_code} ({Number(s.width_mm)}×{Number(s.height_mm)})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={loading || !shapeId || selected.length === 0}
          onClick={() => void run()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {loading ? "Ukládám…" : "Přiřadit vybraným"}
        </button>
      </div>

      {msg && <p className="mt-2 text-sm text-green-800">{msg}</p>}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
