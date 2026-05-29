"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Pencil, Plus, X } from "lucide-react";

type FoilRow = {
  id: number;
  material_id: number;
  name: string;
  code: string | null;
  thickness_label: string | null;
  notes: string | null;
  description: string | null;
  subcategory_id: number | null;
  subcategory_name: string | null;
  is_active: boolean;
};

type SubRow = { id: number; name: string; category_code: string };

const emptyForm = {
  code: "",
  name: "",
  thickness_label: "",
  notes: "",
  subcategory_id: "" as string | number,
  is_active: true,
};

export function ImlFoilSettingsTab({ canWrite }: { canWrite: boolean }) {
  const [rows, setRows] = useState<FoilRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [subsError, setSubsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadSubs = useCallback(async () => {
    setSubsError(false);
    const res = await fetch("/api/materialy/subcategories?category=FOIL");
    if (!res.ok) {
      setSubsError(true);
      setSubs([]);
      return;
    }
    const data = await res.json();
    setSubs((data.subcategories ?? []) as SubRow[]);
  }, []);

  const loadFoils = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (includeInactive) params.set("include_inactive", "1");
    const res = await fetch(`/api/iml/foils?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.foils ?? []);
    }
    setLoading(false);
  }, [q, includeInactive]);

  useEffect(() => {
    void loadSubs();
  }, [loadSubs]);

  useEffect(() => {
    void loadFoils();
  }, [loadFoils]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (row: FoilRow) => {
    setEditingId(row.id);
    setForm({
      code: row.code ?? "",
      name: row.name,
      thickness_label: row.thickness_label ?? "",
      notes: row.notes ?? "",
      subcategory_id: row.subcategory_id ?? "",
      is_active: row.is_active,
    });
    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setError("");
    const payload: Record<string, unknown> = {
      code: form.code.trim(),
      name: form.name.trim(),
      thickness_label: form.thickness_label.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };
    if (form.subcategory_id !== "" && form.subcategory_id != null) {
      payload.subcategory_id = parseInt(String(form.subcategory_id), 10);
    } else {
      payload.subcategory_id = null;
    }

    const url = editingId != null ? `/api/iml/foils/${editingId}` : "/api/iml/foils";
    const method = editingId != null ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Uložení se nezdařilo");
      return;
    }
    closeModal();
    void loadFoils();
  };

  const deactivate = async (row: FoilRow) => {
    if (!canWrite) return;
    if (!confirm(`Deaktivovat fólii „${row.name}“?`)) return;
    const res = await fetch(`/api/iml/foils/${row.id}`, { method: "DELETE" });
    if (res.ok) void loadFoils();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Číselník fólií je uložen v katalogu materiálů (kategorie FOIL). Dokumenty (BL, SDS) spravíte v detailu materiálu.
      </p>

      {subs.length === 0 && !subsError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Pro fólie zatím nejsou definované podtypy.{" "}
          <Link href="/materialy/settings" className="font-medium text-red-700 underline">
            Správa podtypů materiálů
          </Link>
        </div>
      )}
      {subsError && (
        <p className="text-sm text-amber-800">
          Podtypy se nepodařilo načíst (potřebujete oprávnění ke čtení katalogu materiálů). Číselník lze uložit, pokud v
          databázi nejsou aktivní podtypy FOIL.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Hledat</label>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Kód nebo název…"
            className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          Zobrazit neaktivní
        </label>
        {canWrite && (
          <button
            type="button"
            onClick={openNew}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Nová fólie
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Načítání…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">Žádné záznamy.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Kód</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Název</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Tloušťka</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Podtyp</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Aktivní</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Akce</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.material_id} className={!row.is_active ? "bg-gray-50 text-gray-500" : ""}>
                  <td className="px-4 py-2 font-mono text-xs">{row.code ?? "—"}</td>
                  <td className="px-4 py-2">{row.name}</td>
                  <td className="px-4 py-2">{row.thickness_label ?? "—"}</td>
                  <td className="px-4 py-2">{row.subcategory_name ?? "—"}</td>
                  <td className="px-4 py-2">{row.is_active ? "Ano" : "Ne"}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/materialy/${row.material_id}`}
                        className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Katalog
                      </Link>
                      {canWrite && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Upravit
                          </button>
                          {row.is_active && (
                            <button
                              type="button"
                              onClick={() => void deactivate(row)}
                              className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                            >
                              Deaktivovat
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{editingId != null ? "Upravit fólii" : "Nová fólie"}</h3>
              <button type="button" onClick={closeModal} className="rounded p-2 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void submit(e)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Kód *</label>
                  <input
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Tloušťka</label>
                  <input
                    value={form.thickness_label}
                    onChange={(e) => setForm({ ...form, thickness_label: e.target.value })}
                    placeholder="např. 12 µm"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Název *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Podtyp</label>
                <select
                  value={form.subcategory_id === "" ? "" : String(form.subcategory_id)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      subcategory_id: e.target.value === "" ? "" : parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">—</option>
                  {subs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Poznámka</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Aktivní (dostupná pro výběr u produktů)
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={saving || !canWrite}
                  className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? "Ukládám…" : "Uložit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
