"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { normalizePantoneCode } from "@/lib/iml-pantone";

type Pantone = {
  id: number;
  code: string;
  name: string | null;
  hex: string | null;
  is_active: boolean;
};

type FormState = {
  code: string;
  name: string;
  hex: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  code: "",
  name: "",
  hex: "",
  is_active: true,
};

/**
 * Správa číselníku Pantone barev.
 * Struktura i chování je záměrně shodná s ImlFoilsClient (konzistence UX).
 * Kód je normalizován přes lib/iml-pantone.ts (trim/upper/collapse/P+číslo → "P 1234").
 * Mazání = soft-delete (is_active=false), pokud je barva použita na produktech, vrací 409.
 */
export function ImlPantoneColorsClient() {
  const [rows, setRows] = useState<Pantone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<{ id: number | null; form: FormState } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (showInactive) params.set("all", "true");
      if (search.trim()) params.set("search", search.trim());
      const r = await fetch(`/api/iml/pantone-colors?${params.toString()}`);
      const data = await r.json();
      setRows(data.colors ?? []);
    } catch {
      setError("Nepodařilo se načíst Pantone barvy");
    } finally {
      setLoading(false);
    }
  }, [showInactive, search]);

  useEffect(() => {
    load();
  }, [load]);

  const startAdd = () => setEditing({ id: null, form: { ...emptyForm } });
  const startEdit = (p: Pantone) =>
    setEditing({
      id: p.id,
      form: {
        code: p.code,
        name: p.name ?? "",
        hex: p.hex ?? "",
        is_active: p.is_active,
      },
    });

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      const url = editing.id
        ? `/api/iml/pantone-colors/${editing.id}`
        : "/api/iml/pantone-colors";
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

  const handleDelete = async (p: Pantone) => {
    if (!confirm(`Opravdu deaktivovat Pantone „${p.code}"?`)) return;
    setError("");
    try {
      const res = await fetch(`/api/iml/pantone-colors/${p.id}`, { method: "DELETE" });
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

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hledat (kód / název)…"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          Zobrazit i neaktivní
        </label>
        <div className="ml-auto">
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Nová Pantone
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2 font-medium w-12"></th>
              <th className="px-4 py-2 font-medium">Kód</th>
              <th className="px-4 py-2 font-medium">Název</th>
              <th className="px-4 py-2 font-medium">HEX</th>
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
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Žádné Pantone barvy.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr
                  key={p.id}
                  className={p.is_active ? "border-t" : "border-t bg-gray-50 text-gray-500"}
                >
                  <td className="px-4 py-2">
                    <span
                      className="inline-block h-5 w-5 rounded border border-gray-300"
                      style={{ backgroundColor: p.hex ?? "transparent" }}
                      title={p.hex ?? "bez HEX"}
                    />
                  </td>
                  <td className="px-4 py-2 font-mono">{p.code}</td>
                  <td className="px-4 py-2">{p.name ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{p.hex ?? "—"}</td>
                  <td className="px-4 py-2">
                    {p.is_active ? (
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
                        onClick={() => startEdit(p)}
                        className="rounded p-1 text-gray-600 hover:bg-gray-100"
                        title="Upravit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {p.is_active && (
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
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
        <PantoneModal
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

function PantoneModal({
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

  const preview = normalizePantoneCode(form.code);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-lg font-semibold text-gray-900">
            {id ? "Upravit Pantone" : "Nová Pantone"}
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
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-700">Kód *</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => set("code", e.target.value)}
              onBlur={(e) => set("code", normalizePantoneCode(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
              placeholder="P 485 C, BLACK 6 C…"
            />
            {preview && preview !== form.code && (
              <p className="mt-1 text-xs text-gray-500">
                Bude uloženo jako: <span className="font-mono">{preview}</span>
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-700">Název</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="např. Pantone 485 C – sytě červená"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">HEX (volitelné)</label>
            <input
              type="text"
              value={form.hex}
              onChange={(e) => set("hex", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
              placeholder="#E4002B"
            />
          </div>
          <div className="flex items-end">
            <span
              className="inline-block h-10 w-16 rounded border border-gray-300"
              style={{
                backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(form.hex) ? form.hex : "transparent",
              }}
              title="Náhled HEX"
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
