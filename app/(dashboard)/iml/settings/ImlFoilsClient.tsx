"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";

type Foil = {
  id: number;
  code: string;
  name: string;
  thickness: string | null;
  note: string | null;
  is_active: boolean;
};

type FormState = {
  code: string;
  name: string;
  thickness: string;
  note: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  code: "",
  name: "",
  thickness: "",
  note: "",
  is_active: true,
};

/**
 * Správa číselníku fólií (kód, název, tloušťka, poznámka, stav).
 * – Seznam včetně neaktivních (přepínačem "Zobrazit neaktivní").
 * – Vytvoření / úprava přes inline modal (FormState).
 * – Smazání je soft-delete (is_active=false); pokud je fólie navázaná
 *   na aktivní produkty, API vrací 409 a UI zobrazí chybu.
 */
export function ImlFoilsClient() {
  const [foils, setFoils] = useState<Foil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<{ id: number | null; form: FormState } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = showInactive ? "?all=true" : "";
      const r = await fetch(`/api/iml/foils${qs}`);
      const data = await r.json();
      setFoils(data.foils ?? []);
    } catch {
      setError("Nepodařilo se načíst fólie");
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    load();
  }, [load]);

  const startAdd = () => setEditing({ id: null, form: { ...emptyForm } });
  const startEdit = (f: Foil) =>
    setEditing({
      id: f.id,
      form: {
        code: f.code,
        name: f.name,
        thickness: f.thickness ?? "",
        note: f.note ?? "",
        is_active: f.is_active,
      },
    });

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      const url = editing.id ? `/api/iml/foils/${editing.id}` : "/api/iml/foils";
      const method = editing.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing.form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
        setSaving(false);
        return;
      }
      setEditing(null);
      await load();
    } catch {
      setError("Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (f: Foil) => {
    if (!confirm(`Opravdu deaktivovat fólii „${f.name}" (${f.code})?`)) return;
    setError("");
    try {
      const res = await fetch(`/api/iml/foils/${f.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Chyba při mazání");
        return;
      }
      await load();
    } catch {
      setError("Chyba při mazání");
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          Zobrazit i neaktivní
        </label>
        <button
          type="button"
          onClick={startAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          Nová fólie
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2 font-medium">Kód</th>
              <th className="px-4 py-2 font-medium">Název</th>
              <th className="px-4 py-2 font-medium">Tloušťka</th>
              <th className="px-4 py-2 font-medium">Poznámka</th>
              <th className="px-4 py-2 font-medium">Stav</th>
              <th className="px-4 py-2 font-medium text-right">Akce</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Načítání…
                </td>
              </tr>
            ) : foils.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Žádné fólie.
                </td>
              </tr>
            ) : (
              foils.map((f) => (
                <tr key={f.id} className={f.is_active ? "border-t" : "border-t bg-gray-50 text-gray-500"}>
                  <td className="px-4 py-2 font-mono">{f.code}</td>
                  <td className="px-4 py-2">{f.name}</td>
                  <td className="px-4 py-2">{f.thickness ?? "—"}</td>
                  <td className="px-4 py-2 max-w-xs truncate" title={f.note ?? ""}>
                    {f.note ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    {f.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        <Check className="h-3 w-3" /> Aktivní
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                        <X className="h-3 w-3" /> Neaktivní
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(f)}
                        className="rounded p-1 text-gray-600 hover:bg-gray-100"
                        title="Upravit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {f.is_active && (
                        <button
                          type="button"
                          onClick={() => handleDelete(f)}
                          className="rounded p-1 text-red-600 hover:bg-red-50"
                          title="Deaktivovat"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <FoilModal
          editing={editing}
          onChange={(form) => setEditing({ ...editing, form })}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}

function FoilModal({
  editing,
  onChange,
  onClose,
  onSave,
  saving,
}: {
  editing: { id: number | null; form: FormState };
  onChange: (form: FormState) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { id, form } = editing;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    onChange({ ...form, [k]: v });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-lg font-semibold text-gray-900">
            {id ? "Upravit fólii" : "Nová fólie"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Kód *</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => set("code", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="PP35, BOPP50…"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Tloušťka</label>
            <input
              type="text"
              value={form.thickness}
              onChange={(e) => set("thickness", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="50 μm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-700">Název *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Polypropylen bílý, 50 mikronů"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-700">Poznámka</label>
            <textarea
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => set("is_active", e.target.checked)}
                className="rounded border-gray-300"
              />
              Aktivní (dostupná pro výběr u produktů)
            </label>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Ukládám…" : "Uložit"}
          </button>
        </div>
      </div>
    </div>
  );
}
