"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResourceType } from "@/lib/resource-reservation-types";

type Resource = {
  id: number;
  name: string;
  resource_type: string;
  description: string | null;
  location: string | null;
  plate_number: string | null;
  capacity: number | null;
  color: string | null;
  is_active: boolean;
  sort_order: number;
};

type FormState = {
  name: string;
  resource_type: ResourceType;
  description: string;
  location: string;
  plate_number: string;
  capacity: string;
  color: string;
  sort_order: string;
};

const emptyForm = (type: ResourceType): FormState => ({
  name: "",
  resource_type: type,
  description: "",
  location: "",
  plate_number: "",
  capacity: "",
  color: "#2563EB",
  sort_order: "0",
});

export function CalendarResourcesClient({ initialType }: { initialType: ResourceType }) {
  const router = useRouter();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(initialType));
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<ResourceType | "all">("all");

  const load = () => {
    setLoading(true);
    fetch("/api/calendar/resources?type=")
      .then((r) => r.json())
      .then((data) => setResources(data.resources ?? []))
      .catch(() => setError("Načtení se nezdařilo"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = resources.filter(
    (r) => filterType === "all" || r.resource_type === filterType
  );

  const startCreate = () => {
    setEditingId(0);
    setForm(emptyForm(initialType));
    setError("");
  };

  const startEdit = (r: Resource) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      resource_type: r.resource_type as ResourceType,
      description: r.description ?? "",
      location: r.location ?? "",
      plate_number: r.plate_number ?? "",
      capacity: r.capacity != null ? String(r.capacity) : "",
      color: r.color ?? "#2563EB",
      sort_order: String(r.sort_order),
    });
    setError("");
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError("Název je povinný");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        resource_type: form.resource_type,
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        plate_number: form.plate_number.trim() || null,
        capacity: form.capacity ? parseInt(form.capacity, 10) : null,
        color: form.color,
        sort_order: parseInt(form.sort_order, 10) || 0,
        is_active: true,
      };
      const res = await fetch(
        editingId && editingId > 0 ? `/api/calendar/resources/${editingId}` : "/api/calendar/resources",
        {
          method: editingId && editingId > 0 ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Uložení se nezdařilo");
        return;
      }
      setEditingId(null);
      load();
      router.refresh();
    } catch {
      setError("Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id: number) => {
    if (!confirm("Deaktivovat tento zdroj?")) return;
    const res = await fetch(`/api/calendar/resources/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Deaktivace se nezdařila");
      return;
    }
    load();
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as ResourceType | "all")}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">Vše</option>
          <option value="room">Místnosti</option>
          <option value="vehicle">Auta</option>
        </select>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
        >
          Přidat zdroj
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {editingId !== null && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-semibold text-gray-900">
            {editingId > 0 ? "Upravit zdroj" : "Nový zdroj"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Název *</span>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Typ</span>
              <select
                value={form.resource_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, resource_type: e.target.value as ResourceType }))
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="room">Místnost</option>
                <option value="vehicle">Auto</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Umístění</span>
              <input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            {form.resource_type === "vehicle" && (
              <label className="block text-sm">
                <span className="font-medium text-gray-700">SPZ</span>
                <input
                  value={form.plate_number}
                  onChange={(e) => setForm((f) => ({ ...f, plate_number: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
            )}
            {form.resource_type === "room" && (
              <label className="block text-sm">
                <span className="font-medium text-gray-700">Kapacita</span>
                <input
                  type="number"
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
            )}
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Barva</span>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-gray-300"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-gray-700">Popis</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? "Ukládám…" : "Uložit"}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Zrušit
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Načítám…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3">Název</th>
                <th className="px-4 py-3">Typ</th>
                <th className="px-4 py-3">Detail</th>
                <th className="px-4 py-3">Akce</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <span
                      className="mr-2 inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: r.color ?? "#2563EB" }}
                    />
                    {r.name}
                  </td>
                  <td className="px-4 py-3">{r.resource_type === "room" ? "Místnost" : "Auto"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.resource_type === "vehicle"
                      ? r.plate_number || "—"
                      : r.location || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="text-red-600 hover:underline"
                      >
                        Upravit
                      </button>
                      <button
                        type="button"
                        onClick={() => deactivate(r.id)}
                        className="text-gray-600 hover:underline"
                      >
                        Deaktivovat
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    Žádné zdroje
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
