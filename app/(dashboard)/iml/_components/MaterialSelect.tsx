"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MaterialCategoryCode } from "@/lib/materialy/categories";

type Option = {
  id: number;
  label: string;
  name: string;
  code: string | null;
};

type Props = {
  category: MaterialCategoryCode;
  label: string;
  value: string;
  onChange: (materialId: string, label?: string) => void;
  coverageValue?: string;
  onCoverageChange?: (v: string) => void;
  coverageLabel?: string;
};

export function MaterialSelect({
  category,
  label,
  value,
  onChange,
  coverageValue,
  onCoverageChange,
  coverageLabel,
}: Props) {
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/materialy/options?category=${category}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setOptions(data.options ?? []);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  const selected = options.find((o) => String(o.id) === value);

  return (
    <div className="space-y-2">
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <select
        value={value}
        onChange={(e) => {
          const id = e.target.value;
          const opt = options.find((o) => String(o.id) === id);
          onChange(id, opt?.label ?? "");
        }}
        className="w-full rounded-lg border border-gray-300 px-3 py-2"
        disabled={loading}
      >
        <option value="">{loading ? "Načítání…" : "— vyberte —"}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      {category === "COLOR" && onCoverageChange ? (
        <input
          type="text"
          value={coverageValue ?? ""}
          onChange={(e) => onCoverageChange(e.target.value)}
          placeholder={coverageLabel ?? "Poznámka / % pokrytí"}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      ) : null}
      {selected ? (
        <p className="text-xs text-gray-500">
          Katalog:{" "}
          <Link href={`/materialy/${selected.id}`} className="text-red-600 hover:underline">
            {selected.label}
          </Link>
        </p>
      ) : null}
      <p className="text-xs text-gray-400">
        <Link href={`/materialy/add?category=${category}`} className="text-red-600 hover:underline">
          + Nový materiál v katalogu
        </Link>
      </p>
    </div>
  );
}
