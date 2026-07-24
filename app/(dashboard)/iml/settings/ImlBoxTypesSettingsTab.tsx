"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";

type BoxTypeRow = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

const emptyForm = {
  code: "",
  name: "",
  description: "",
  is_active: true,
};

export function ImlBoxTypesSettingsTab({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<BoxTypeRow[]>([]);
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
    const res = await fetch(`/api/iml/box-types?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.box_types ?? []);
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

  const openEdit = (row: BoxTypeRow) => {
    setEditingId(row.id);
    setForm({
      code: row.code,
      name: row.name,
      description: row.description ?? "",
      is_active: row.is_active,
    });
    setError("");
    setModalOpen(true);
  };

  const save = async () => {
    if (!canWrite) return;
    setSaving(true);
    setError("");
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      is_active: form.is_active,
    };
    const res = await fetch(
      editingId ? `/api/iml/box-types/${editingId}` : "/api/iml/box-types",
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

  const deactivate = async (row: BoxTypeRow) => {
    if (!confirm(`Deaktivovat typ krabice „${row.code}“?`)) return;
    const res = await fetch(`/api/iml/box-types/${row.id}`, { method: "DELETE" });
    if (res.ok) void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Číselník typů krabic pro katalog výseků (kód, název, popis).
        </p>
        {canWrite && (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Nový typ
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hledat kód, název…"
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
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Kód</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Název</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Popis</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Stav</th>
              {canWrite && <th className="px-3 py-2 text-right font-semibold text-gray-700">Akce</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                  Načítání…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                  Žádné typy krabic.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-gray-100 ${row.is_active ? "" : "bg-gray-50 text-gray-500"}`}
                >
                  <td className="px-3 py-2 font-mono font-medium">{row.code}</td>
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="max-w-[280px] truncate px-3 py-2">{row.description ?? "—"}</td>
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
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingId ? "Upravit typ krabice" : "Nový typ krabice"}
            </h2>
            {error && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Kód *</span>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Název *</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Popis</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              {editingId != null && (
                <label className="flex items-center gap-2 text-sm">
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
                disabled={saving || !form.code.trim() || !form.name.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? "Ukládám…" : "Uložit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
