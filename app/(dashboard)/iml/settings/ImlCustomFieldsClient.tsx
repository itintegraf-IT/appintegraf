"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Database, X } from "lucide-react";

type CustomField = {
  id: number;
  entity: string;
  field_key: string;
  label: string;
  field_type: string;
  sort_order: number;
  is_active: boolean;
};

const ENTITIES = [
  { value: "products", label: "Produkty" },
  { value: "orders", label: "Objednávky" },
] as const;

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Číslo" },
  { value: "date", label: "Datum" },
  { value: "boolean", label: "Ano/Ne" },
] as const;

export function ImlCustomFieldsClient() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    entity: "products",
    field_key: "",
    label: "",
    field_type: "text",
    sort_order: "0",
  });
  const [error, setError] = useState("");
  const [showDbSchema, setShowDbSchema] = useState(false);

  const fetchFields = async () => {
    setLoading(true);
    const res = await fetch("/api/iml/custom-fields?all=true");
    if (res.ok) {
      const data = await res.json();
      setFields(data.fields ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFields();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const key = form.field_key.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || `pole_${Date.now()}`;

    if (editingId) {
      const res = await fetch(`/api/iml/custom-fields/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.label.trim(),
          field_type: form.field_type,
          sort_order: parseInt(form.sort_order, 10) || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Chyba při úpravě");
        return;
      }
      setEditingId(null);
    } else {
      const res = await fetch("/api/iml/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: form.entity,
          field_key: key,
          label: form.label.trim(),
          field_type: form.field_type,
          sort_order: parseInt(form.sort_order, 10) || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Chyba při vytváření");
        return;
      }
    }

    setForm({ entity: "products", field_key: "", label: "", field_type: "text", sort_order: "0" });
    setShowForm(false);
    fetchFields();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Opravdu smazat toto pole? Hodnoty v existujících záznamech zůstanou uloženy.")) return;
    const res = await fetch(`/api/iml/custom-fields/${id}`, { method: "DELETE" });
    if (res.ok) fetchFields();
  };

  const startEdit = (f: CustomField) => {
    setEditingId(f.id);
    setForm({
      entity: f.entity,
      field_key: f.field_key,
      label: f.label,
      field_type: f.field_type,
      sort_order: String(f.sort_order),
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ entity: "products", field_key: "", label: "", field_type: "text", sort_order: "0" });
  };

  const productsFields = fields.filter((f) => f.entity === "products");
  const ordersFields = fields.filter((f) => f.entity === "orders");

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowDbSchema(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <Database className="h-4 w-4" />
          Struktura databáze
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            {editingId ? "Upravit pole" : "Přidat vlastní pole"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Entita</label>
              <select
                value={form.entity}
                onChange={(e) => setForm({ ...form, entity: e.target.value })}
                disabled={!!editingId}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
              >
                {ENTITIES.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Klíč pole (identifikátor)</label>
              <input
                type="text"
                value={form.field_key}
                onChange={(e) => setForm({ ...form, field_key: e.target.value })}
                placeholder="např. dodaci_cas"
                disabled={!!editingId}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
              />
              {!editingId && (
                <p className="mt-1 text-xs text-gray-500">Pouze písmena, čísla, podtržítko. Automaticky se převede.</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Popisek (label) *</label>
              <input
                type="text"
                required
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="např. Dodací čas"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Typ pole</label>
              <select
                value={form.field_type}
                onChange={(e) => setForm({ ...form, field_type: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Pořadí</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
            >
              {editingId ? "Uložit" : "Přidat"}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Zrušit
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          Přidat vlastní pole
        </button>
      )}

      {showDbSchema && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDbSchema(false)}>
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Struktura databáze – vlastní pole</h3>
              <button
                type="button"
                onClick={() => setShowDbSchema(false)}
                className="rounded p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 font-mono text-sm">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="mb-2 font-semibold text-gray-800">iml_custom_fields</p>
                <p className="text-gray-600">Definice vlastních polí</p>
                <ul className="mt-2 space-y-1 text-gray-700">
                  <li>• entity (varchar) – „products“ nebo „orders“</li>
                  <li>• field_key (varchar) – identifikátor pole</li>
                  <li>• label (varchar) – zobrazený popisek</li>
                  <li>• field_type (varchar) – text, number, date, boolean</li>
                  <li>• sort_order (int) – pořadí zobrazení</li>
                </ul>
              </div>
              <div className="text-center text-gray-500">↓</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                  <p className="mb-2 font-semibold text-blue-900">iml_products</p>
                  <p className="text-gray-600">custom_data (JSON)</p>
                  <p className="mt-1 text-xs text-gray-500">Hodnoty vlastních polí: {`{ "field_key": "hodnota" }`}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                  <p className="mb-2 font-semibold text-amber-900">iml_orders</p>
                  <p className="text-gray-600">custom_data (JSON)</p>
                  <p className="mt-1 text-xs text-gray-500">Hodnoty vlastních polí: {`{ "field_key": "hodnota" }`}</p>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Vazba: iml_custom_fields.entity určuje, zda se pole zobrazuje u produktů nebo objednávek. Hodnoty se ukládají do sloupce custom_data jako JSON objekt.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Pole u produktů</h3>
          {loading ? (
            <p className="text-sm text-gray-500">Načítání…</p>
          ) : productsFields.length === 0 ? (
            <p className="text-sm text-gray-500">Žádná vlastní pole. Přidejte pole výše.</p>
          ) : (
            <ul className="space-y-2">
              {productsFields.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2"
                >
                  <div>
                    <span className="font-medium">{f.label}</span>
                    <span className="ml-2 text-xs text-gray-500">({f.field_key}, {f.field_type})</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(f)}
                      className="rounded p-2 text-gray-600 hover:bg-gray-200"
                      title="Upravit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(f.id)}
                      className="rounded p-2 text-red-600 hover:bg-red-50"
                      title="Smazat"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Pole u objednávek</h3>
          {loading ? (
            <p className="text-sm text-gray-500">Načítání…</p>
          ) : ordersFields.length === 0 ? (
            <p className="text-sm text-gray-500">Žádná vlastní pole. Přidejte pole výše.</p>
          ) : (
            <ul className="space-y-2">
              {ordersFields.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2"
                >
                  <div>
                    <span className="font-medium">{f.label}</span>
                    <span className="ml-2 text-xs text-gray-500">({f.field_key}, {f.field_type})</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(f)}
                      className="rounded p-2 text-gray-600 hover:bg-gray-200"
                      title="Upravit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(f.id)}
                      className="rounded p-2 text-red-600 hover:bg-red-50"
                      title="Smazat"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
