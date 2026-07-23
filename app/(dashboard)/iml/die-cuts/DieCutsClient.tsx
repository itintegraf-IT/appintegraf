"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, Search } from "lucide-react";

type DieCutRow = {
  id: number;
  label_shape_code: string;
  die_cut_tool_code: string | null;
  assembly_code: string | null;
  positions_on_sheet: number | null;
  labels_per_sheet: number | null;
  pieces_per_box: number | null;
  pieces_per_pallet: number | null;
  note: string | null;
  is_active: boolean;
  products_count?: number;
};

const emptyForm = {
  label_shape_code: "",
  die_cut_tool_code: "",
  assembly_code: "",
  positions_on_sheet: "",
  labels_per_sheet: "",
  pieces_per_box: "",
  pieces_per_pallet: "",
  note: "",
  is_active: true,
};

export function DieCutsClient({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<DieCutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (includeInactive) params.set("include_inactive", "1");
    const res = await fetch(`/api/iml/die-cuts?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.die_cuts ?? []);
    }
    setLoading(false);
  }, [q, includeInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (row: DieCutRow) => {
    setEditingId(row.id);
    setForm({
      label_shape_code: row.label_shape_code ?? "",
      die_cut_tool_code: row.die_cut_tool_code ?? "",
      assembly_code: row.assembly_code ?? "",
      positions_on_sheet: row.positions_on_sheet != null ? String(row.positions_on_sheet) : "",
      labels_per_sheet: row.labels_per_sheet != null ? String(row.labels_per_sheet) : "",
      pieces_per_box: row.pieces_per_box != null ? String(row.pieces_per_box) : "",
      pieces_per_pallet: row.pieces_per_pallet != null ? String(row.pieces_per_pallet) : "",
      note: row.note ?? "",
      is_active: row.is_active,
    });
    setError("");
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    const payload = {
      label_shape_code: form.label_shape_code.trim(),
      die_cut_tool_code: form.die_cut_tool_code.trim() || null,
      assembly_code: form.assembly_code.trim() || null,
      positions_on_sheet: form.positions_on_sheet.trim() || null,
      labels_per_sheet: form.labels_per_sheet.trim() || null,
      pieces_per_box: form.pieces_per_box.trim() || null,
      pieces_per_pallet: form.pieces_per_pallet.trim() || null,
      note: form.note.trim() || null,
      is_active: form.is_active,
    };
    const res = await fetch(
      editingId ? `/api/iml/die-cuts/${editingId}` : "/api/iml/die-cuts",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Chyba při ukládání");
      return;
    }
    setModalOpen(false);
    void load();
  };

  const deactivate = async (row: DieCutRow) => {
    if (!confirm(`Deaktivovat výsek „${row.label_shape_code}“?`)) return;
    const res = await fetch(`/api/iml/die-cuts/${row.id}`, { method: "DELETE" });
    if (res.ok) void load();
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Výseky</h1>
          <p className="mt-1 text-gray-600">
            Globální katalog – unikátní klíč je kód tvaru etikety. U produktu se výsek vybírá ze
            seznamu.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/iml"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            IML
          </Link>
          {canWrite && (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Nový výsek
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hledat kód tvaru, nástroj, montáž…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          Zobrazit neaktivní
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Kód tvaru</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Výsekový nástroj</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Montáž</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Pozic</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Etiket/TA</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Krabice</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Paleta</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Produkty</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Stav</th>
              {canWrite && <th className="px-3 py-2 text-right font-semibold text-gray-700">Akce</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                  Načítání…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                  Žádné výseky. {canWrite ? "Přidejte první přes „Nový výsek“." : ""}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-gray-100 ${row.is_active ? "" : "bg-gray-50 text-gray-500"}`}
                >
                  <td className="px-3 py-2 font-mono font-medium">{row.label_shape_code}</td>
                  <td className="px-3 py-2">{row.die_cut_tool_code ?? "—"}</td>
                  <td className="px-3 py-2">{row.assembly_code ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{row.positions_on_sheet ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{row.labels_per_sheet ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{row.pieces_per_box ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{row.pieces_per_pallet ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{row.products_count ?? 0}</td>
                  <td className="px-3 py-2">
                    {row.is_active ? (
                      <span className="text-green-700">aktivní</span>
                    ) : (
                      <span className="text-gray-500">neaktivní</span>
                    )}
                  </td>
                  {canWrite && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="mr-2 inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        <Pencil className="h-3 w-3" />
                        Upravit
                      </button>
                      {row.is_active && (
                        <button
                          type="button"
                          onClick={() => void deactivate(row)}
                          className="inline-flex items-center rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          Deaktivovat
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingId ? "Upravit výsek" : "Nový výsek"}
            </h2>
            {error && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-gray-700">Kód tvaru etikety *</span>
                <input
                  type="text"
                  value={form.label_shape_code}
                  onChange={(e) => setForm({ ...form, label_shape_code: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Kód výsekového nástroje</span>
                <input
                  type="text"
                  value={form.die_cut_tool_code}
                  onChange={(e) => setForm({ ...form, die_cut_tool_code: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Kód montáže</span>
                <input
                  type="text"
                  value={form.assembly_code}
                  onChange={(e) => setForm({ ...form, assembly_code: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Pozic na archu</span>
                <input
                  type="number"
                  value={form.positions_on_sheet}
                  onChange={(e) => setForm({ ...form, positions_on_sheet: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Etiket na tiskový arch</span>
                <input
                  type="number"
                  min={1}
                  value={form.labels_per_sheet}
                  onChange={(e) => setForm({ ...form, labels_per_sheet: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Kusů v krabici</span>
                <input
                  type="number"
                  value={form.pieces_per_box}
                  onChange={(e) => setForm({ ...form, pieces_per_box: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Kusů na paletě</span>
                <input
                  type="number"
                  value={form.pieces_per_pallet}
                  onChange={(e) => setForm({ ...form, pieces_per_pallet: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-gray-700">Poznámka</span>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              {editingId != null && (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  Aktivní
                </label>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !form.label_shape_code.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? "Ukládám…" : "Uložit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
