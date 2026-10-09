"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";

export type CodebookConfig = {
  title: string;
  apiBase: string;
  backHref: string;
  itemLabel: string;
  countField: string;
};

type CodebookItem = {
  id: number;
  name: string;
  is_active: boolean | null;
  sort_order: number | null;
  _count?: Record<string, number>;
};

export function TechnologieCodebookClient({ config }: { config: CodebookConfig }) {
  const [items, setItems] = useState<CodebookItem[]>([]);
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
      const res = await fetch(`${config.apiBase}?active=false`);
      const data = (await res.json().catch(() => ({}))) as {
        items?: CodebookItem[];
        error?: string;
      };
      if (!res.ok) {
        setItems([]);
        setError(data.error ?? "Nepodařilo se načíst číselník.");
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError("Chyba při načítání.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [config.apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(config.apiBase, {
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
      const res = await fetch(`${config.apiBase}/${id}`, {
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

  const onToggleActive = async (item: CodebookItem) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${config.apiBase}/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: item.name, is_active: !(item.is_active !== false) }),
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

  const onDelete = async (id: number) => {
    if (!confirm(`Smazat nebo deaktivovat ${config.itemLabel}?`)) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${config.apiBase}/${id}`, { method: "DELETE" });
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
    <div className="mx-auto max-w-2xl">
      <Link
        href={config.backHref}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Zpět
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">{config.title}</h1>

      {error && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      <form onSubmit={onCreate} className="mt-6 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Nový ${config.itemLabel}…`}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          maxLength={150}
        />
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Přidat
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <p className="px-4 py-8 text-center text-gray-500">Načítání…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-500">Prázdný číselník</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => {
              const used = item._count?.[config.countField] ?? 0;
              const isEditing = editingId === item.id;
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1"
                        autoFocus
                      />
                    ) : (
                      <>
                        <span
                          className={
                            item.is_active === false ? "text-gray-400 line-through" : "font-medium"
                          }
                        >
                          {item.name}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">použito: {used}</span>
                      </>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void onSaveEdit(item.id)}
                          disabled={saving}
                          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                        >
                          Uložit
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                        >
                          Zrušit
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditName(item.name);
                          }}
                          className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
                          title="Upravit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void onToggleActive(item)}
                          disabled={saving}
                          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                        >
                          {item.is_active === false ? "Aktivovat" : "Deaktivovat"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(item.id)}
                          disabled={saving}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50"
                          title="Smazat"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
