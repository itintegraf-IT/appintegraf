"use client";

import { useEffect, useRef, useState } from "react";
import { Columns3, RotateCcw } from "lucide-react";
import {
  PRODUCT_LIST_COLUMN_GROUPS,
  PRODUCT_LIST_COLUMNS,
  type ProductListColumnId,
} from "@/lib/iml/product-list-columns";

type Props = {
  visibleColumnIds: ProductListColumnId[];
  onToggle: (id: ProductListColumnId) => void;
  onReset: () => void;
};

export function ProductListColumnPicker({ visibleColumnIds, onToggle, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const optionalCount = visibleColumnIds.filter((id) => {
    const col = PRODUCT_LIST_COLUMNS.find((c) => c.id === id);
    return col && !col.locked;
  }).length;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm ${
          open
            ? "border-red-300 bg-red-50 text-red-800"
            : "border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
        title="Vyberte sloupce tabulky"
      >
        <Columns3 className="h-4 w-4" />
        Sloupce
        {optionalCount > 0 && (
          <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-700">
            {visibleColumnIds.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">Zobrazené sloupce</p>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              title="Obnovit výchozí sloupce"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Výchozí
            </button>
          </div>

          <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
            {PRODUCT_LIST_COLUMN_GROUPS.map((group) => {
              const cols = PRODUCT_LIST_COLUMNS.filter((c) => c.group === group.id);
              if (cols.length === 0) return null;
              return (
                <div key={group.id}>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                    {group.label}
                  </p>
                  <ul className="space-y-1">
                    {cols.map((col) => {
                      const checked = visibleColumnIds.includes(col.id);
                      return (
                        <li key={col.id}>
                          <label
                            className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                              col.locked ? "cursor-default text-gray-500" : "hover:bg-gray-50"
                            }`}
                            title={
                              col.locked
                                ? "Tento sloupec je vždy zobrazen"
                                : undefined
                            }
                          >
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 text-red-600 focus:ring-red-500 disabled:opacity-60"
                              checked={checked}
                              disabled={col.locked}
                              onChange={() => onToggle(col.id)}
                            />
                            <span>{col.label}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
