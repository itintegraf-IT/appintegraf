"use client";

import { Plus, Star, Trash2 } from "lucide-react";
import { IML_EMAIL_KINDS } from "@/lib/iml-customer-units";

export type CustomerEmailRow = {
  email: string;
  kind: string;
  is_primary: boolean;
  sort_order: number;
};

const kindLabels: Record<string, string> = {
  general: "Obecný",
  orders: "Objednávky",
};

/** V editoru e-mailů není billing – ten je ve fakturační sekci. */
const EDITOR_EMAIL_KINDS = IML_EMAIL_KINDS.filter((k) => k !== "billing");

type Props = {
  rows: CustomerEmailRow[];
  onChange: (rows: CustomerEmailRow[]) => void;
  disabled?: boolean;
};

export function emptyEmailRow(): CustomerEmailRow {
  return { email: "", kind: "general", is_primary: false, sort_order: 0 };
}

export default function CustomerEmailsEditor({ rows, onChange, disabled }: Props) {
  const setRow = (index: number, patch: Partial<CustomerEmailRow>) => {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const addRow = () => onChange([...rows, { ...emptyEmailRow(), sort_order: rows.length }]);

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
        <p className="text-sm text-gray-500">Žádné e-maily – přidejte řádek nebo vyplňte hlavní pole výše.</p>
      )}
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-600">E-mail</label>
            <input
              type="email"
              value={row.email}
              disabled={disabled}
              onChange={(e) => setRow(i, { email: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="jmeno@domena.cz"
            />
          </div>
          <div className="w-36">
            <label className="mb-1 block text-xs font-medium text-gray-600">Účel</label>
            <select
              value={row.kind}
              disabled={disabled}
              onChange={(e) => setRow(i, { kind: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
            >
              {EDITOR_EMAIL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {kindLabels[k] ?? k}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-1 pt-6">
            <button
              type="button"
              disabled={disabled || row.is_primary}
              onClick={() => setPrimary(i)}
              title="Nastavit jako primární"
              className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-white disabled:opacity-40"
            >
              <Star className={`h-4 w-4 ${row.is_primary ? "fill-amber-400 text-amber-500" : ""}`} />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeRow(i)}
              className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
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
        Přidat e-mail
      </button>
    </div>
  );
}
