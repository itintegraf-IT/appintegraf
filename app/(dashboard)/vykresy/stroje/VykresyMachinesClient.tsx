"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";

type Machine = {
  id: number;
  name: string;
  is_active: boolean | null;
  sort_order: number | null;
  _count?: { vykresy: number };
};

export function VykresyMachinesClient() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/vykresy/machines?active=false");
      const data = (await res.json().catch(() => ({}))) as {
        machines?: Machine[];
        error?: string;
      };
      if (!res.ok) {
        setMachines([]);
        setError(data.error ?? "Nepodařilo se načíst stroje.");
        return;
      }
      setMachines(Array.isArray(data.machines) ? data.machines : []);
    } catch {
      setError("Chyba při načítání.");
      setMachines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/vykresy/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Uložení se nezdařilo.");
        return;
      }
      setName("");
      await load();
    } catch {
      setError("Chyba při ukládání.");
    } finally {
      setSaving(false);
    }
  };

  const onSaveEdit = async (id: number) => {
    if (!editName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/vykresy/machines/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Uložení se nezdařilo.");
        return;
      }
      setEditingId(null);
      await load();
    } catch {
      setError("Chyba při ukládání.");
    } finally {
      setSaving(false);
    }
  };

  const onToggleActive = async (m: Machine) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/vykresy/machines/${m.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: m.name, is_active: !(m.is_active !== false) }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Změna se nezdařila.");
        return;
      }
      await load();
    } catch {
      setError("Chyba při ukládání.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (m: Machine) => {
    if (!confirm(`Smazat nebo deaktivovat stroj „${m.name}“?`)) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/vykresy/machines/${m.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Smazání se nezdařilo.");
        return;
      }
      if (data.message) {
        setError(data.message);
      }
      await load();
    } catch {
      setError("Chyba při mazání.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-6">
        <Link
          href="/vykresy"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět na výkresy
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Číselník strojů</h1>
        <p className="mt-1 text-gray-600">
          Stroje, ke kterým lze přiřadit výkres nebo 3D model
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => void onCreate(e)}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <label className="min-w-[200px] flex-1 text-sm">
          <span className="mb-1 block text-gray-600">Nový stroj</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="Název stroje"
            maxLength={150}
            required
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Přidat
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Název</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Výkresů</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stav</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Akce</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Načítání…
                </td>
              </tr>
            ) : machines.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Zatím žádné stroje
                </td>
              </tr>
            ) : (
              machines.map((m) => (
                <tr key={m.id} className="border-b border-gray-100">
                  <td className="px-4 py-3">
                    {editingId === m.id ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full max-w-xs rounded border border-gray-300 px-2 py-1 text-sm"
                        maxLength={150}
                      />
                    ) : (
                      <span className="font-medium text-gray-900">{m.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{m._count?.vykresy ?? 0}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-sm ${
                        m.is_active !== false
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {m.is_active !== false ? "Aktivní" : "Neaktivní"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-2">
                      {editingId === m.id ? (
                        <>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void onSaveEdit(m.id)}
                            className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
                          >
                            Uložit
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
                          >
                            Zrušit
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(m.id);
                              setEditName(m.name);
                            }}
                            className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Upravit
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void onToggleActive(m)}
                            className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
                          >
                            {m.is_active !== false ? "Deaktivovat" : "Aktivovat"}
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void onDelete(m)}
                            className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-sm text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Smazat
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
