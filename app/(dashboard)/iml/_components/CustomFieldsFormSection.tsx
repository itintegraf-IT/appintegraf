"use client";

import { useState, useEffect } from "react";

type CustomField = {
  id: number;
  entity: string;
  field_key: string;
  label: string;
  field_type: string;
  sort_order: number;
};

type Props = {
  entity: "products" | "orders" | "inquiries";
  values: Record<string, string | number | boolean>;
  onChange: (values: Record<string, string | number | boolean>) => void;
};

export function CustomFieldsFormSection({ entity, values, onChange }: Props) {
  const [fields, setFields] = useState<CustomField[]>([]);

  useEffect(() => {
    fetch(`/api/iml/custom-fields?entity=${entity}`)
      .then((r) => r.json())
      .then((d) => setFields(d.fields ?? []))
      .catch(() => setFields([]));
  }, [entity]);

  const handleChange = (key: string, value: string | number | boolean) => {
    onChange({ ...values, [key]: value });
  };

  if (fields.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-700">Vlastní pole</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.id}>
            <label className="mb-1 block text-sm font-medium text-gray-700">{f.label}</label>
            {f.field_type === "text" && (
              <input
                type="text"
                value={String(values[f.field_key] ?? "")}
                onChange={(e) => handleChange(f.field_key, e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            )}
            {f.field_type === "number" && (
              <input
                type="number"
                step="any"
                value={values[f.field_key] !== "" && values[f.field_key] !== undefined ? String(values[f.field_key]) : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  handleChange(f.field_key, v === "" ? "" : parseFloat(v) || 0);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            )}
            {f.field_type === "date" && (
              <input
                type="date"
                value={String(values[f.field_key] ?? "")}
                onChange={(e) => handleChange(f.field_key, e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            )}
            {f.field_type === "boolean" && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!values[f.field_key]}
                  onChange={(e) => handleChange(f.field_key, e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-600">Ano</span>
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
