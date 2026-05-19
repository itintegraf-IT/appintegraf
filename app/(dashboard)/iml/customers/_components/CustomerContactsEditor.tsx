"use client";

import { Plus, Star, Trash2 } from "lucide-react";

export type CustomerContactRow = {
  name: string;
  phone: string;
  email: string;
  role: string;
  is_primary: boolean;
  sort_order: number;
};

type Props = {
  rows: CustomerContactRow[];
  onChange: (rows: CustomerContactRow[]) => void;
  disabled?: boolean;
};

export function emptyContactRow(): CustomerContactRow {
  return { name: "", phone: "", email: "", role: "", is_primary: false, sort_order: 0 };
}

export default function CustomerContactsEditor({ rows, onChange, disabled }: Props) {
  const setRow = (index: number, patch: Partial<CustomerContactRow>) => {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const addRow = () => onChange([...rows, { ...emptyContactRow(), sort_order: rows.length }]);

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    if (next.length > 0 && !next.some((r) => r.is_primary)) next[0].is_primary = true;
    onChange(next);
  };

  const setPrimary = (index: number) => {
    onChange(rows.map((r, i) => ({ ...r, is_primary: i === index })));
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="text-sm text-gray-500">Žádné kontaktní osoby – přidejte řádek.</p>
      )}
      {rows.map((row, i) => (
        <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Kontakt #{i + 1}</span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={disabled || row.is_primary}
                onClick={() => setPrimary(i)}
                title="Primární kontakt"
                className="rounded border border-gray-300 p-1.5 text-gray-600 hover:bg-white disabled:opacity-40"
              >
                <Star className={`h-3.5 w-3.5 ${row.is_primary ? "fill-amber-400 text-amber-500" : ""}`} />
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeRow(i)}
                className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-gray-600">Jméno *</label>
              <input
                type="text"
                value={row.name}
                disabled={disabled}
                onChange={(e) => setRow(i, { name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Telefon</label>
              <input
                type="tel"
                value={row.phone}
                disabled={disabled}
                onChange={(e) => setRow(i, { phone: e.target.value })}
                placeholder="+420 …"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">E-mail</label>
              <input
                type="email"
                value={row.email}
                disabled={disabled}
                onChange={(e) => setRow(i, { email: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-gray-600">Role / poznámka</label>
              <input
                type="text"
                value={row.role}
                disabled={disabled}
                onChange={(e) => setRow(i, { role: e.target.value })}
                placeholder="např. Nákupčí"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={addRow}
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        <Plus className="h-4 w-4" />
        Přidat kontakt
      </button>
    </div>
  );
}
