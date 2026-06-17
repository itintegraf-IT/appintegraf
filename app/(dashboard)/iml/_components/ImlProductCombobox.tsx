"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  filterProductsByQuery,
  formatProductLabel,
  type ImlSearchableProduct,
} from "@/lib/iml-product-search";

type Props = {
  products: ImlSearchableProduct[];
  value: string;
  onChange: (productId: string) => void;
  excludeIds?: Set<number>;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export default function ImlProductCombobox({
  products,
  value,
  onChange,
  excludeIds,
  disabled = false,
  placeholder = "Hledat produkt (kód / název)…",
  className = "",
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => products.find((p) => String(p.id) === value) ?? null,
    [products, value]
  );

  const available = useMemo(
    () => (excludeIds ? products.filter((p) => !excludeIds.has(p.id)) : products),
    [products, excludeIds]
  );

  const filtered = useMemo(
    () => filterProductsByQuery(available, query),
    [available, query]
  );

  useEffect(() => {
    if (!open) {
      setQuery(selected ? formatProductLabel(selected) : "");
    }
  }, [selected, open]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (id: number) => {
    onChange(String(id));
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative min-w-[200px] flex-1 ${className}`}>
      <input
        type="text"
        disabled={disabled}
        value={open ? query : selected ? formatProductLabel(selected) : query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value.trim()) onChange("");
        }}
        onFocus={() => {
          setOpen(true);
          setQuery(selected ? formatProductLabel(selected) : "");
        }}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
      />
      {open && !disabled && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">Žádný produkt</li>
          ) : (
            filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pick(p.id)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                    String(p.id) === value ? "bg-red-50 text-red-800" : "text-gray-800"
                  }`}
                >
                  {formatProductLabel(p)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
