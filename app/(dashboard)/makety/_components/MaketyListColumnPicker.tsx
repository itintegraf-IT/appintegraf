"use client";

import { useEffect, useRef, useState } from "react";
import { Columns3, RotateCcw } from "lucide-react";
import {
  MAKETY_LIST_COLUMN_GROUPS,
  availableMaketyListColumns,
  type MaketyListColumnId,
} from "@/lib/makety/makety-list-columns";
import { MaketyListColumnOrderList } from "./MaketyListColumnOrderList";

type Props = {
  canModuleAdmin: boolean;
  visibleColumnIds: MaketyListColumnId[];
  onToggle: (id: MaketyListColumnId) => void;
  onReorder: (activeId: MaketyListColumnId, overId: MaketyListColumnId) => void;
  onReset: () => void;
};

export function MaketyListColumnPicker({
  canModuleAdmin,
  visibleColumnIds,
  onToggle,
  onReorder,
  onReset,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const columns = availableMaketyListColumns(canModuleAdmin);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
          open
            ? "border-violet-300 bg-violet-50 text-violet-800"
            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        }`}
        title="Vyberte sloupce tabulky"
      >
        <Columns3 className="h-4 w-4" />
        Sloupce
        <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-700">
          {visibleColumnIds.length}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
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

          <MaketyListColumnOrderList
            columnIds={visibleColumnIds}
            canModuleAdmin={canModuleAdmin}
            onReorder={onReorder}
          />

          <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {MAKETY_LIST_COLUMN_GROUPS.map((group) => {
              const cols = columns.filter((c) => c.group === group.id);
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
                            className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50 ${
                              col.locked ? "cursor-not-allowed opacity-60" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={col.locked}
                              onChange={() => onToggle(col.id)}
                              className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                            />
                            <span className="text-gray-800">{col.label}</span>
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
