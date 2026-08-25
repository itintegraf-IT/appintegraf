"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type EquipmentFilterOption = { value: string; label: string };

export function normalizeEquipmentSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function EquipmentFilterCombobox({
  options,
  value,
  onChange,
  allLabel = "Vše",
  placeholder = "Filtrovat…",
}: {
  options: EquipmentFilterOption[];
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const selected = useMemo(
    () => (value ? options.find((o) => o.value === value) ?? null : null),
    [options, value]
  );
  const display = selected?.label ?? allLabel;

  const filtered = useMemo(() => {
    const q = normalizeEquipmentSearch(query);
    const withAll: EquipmentFilterOption[] = [{ value: "", label: allLabel }, ...options];
    if (!q) return withAll;
    return withAll.filter((o) => normalizeEquipmentSearch(o.label).includes(q));
  }, [options, query, allLabel]);

  const updateMenuPos = () => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuPos({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 160),
    });
  };

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    updateMenuPos();
    const onWin = () => updateMenuPos();
    window.addEventListener("scroll", onWin, true);
    window.addEventListener("resize", onWin);
    return () => {
      window.removeEventListener("scroll", onWin, true);
      window.removeEventListener("resize", onWin);
    };
  }, [open]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative min-w-[9.5rem] font-normal">
      <input
        type="text"
        value={open ? query : display}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        className={`w-full rounded border px-2 py-1 text-xs ${
          value ? "border-red-300 bg-red-50 text-red-800" : "border-gray-300 bg-white text-gray-800"
        }`}
        aria-label={placeholder}
      />
      {open && menuPos && typeof document !== "undefined"
        ? createPortal(
            <ul
              ref={menuRef}
              style={{ top: menuPos.top, left: menuPos.left, minWidth: menuPos.width }}
              className="fixed z-50 max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-left shadow-lg"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-1.5 text-xs text-gray-500">Nic nenalezeno</li>
              ) : (
                filtered.map((o) => (
                  <li key={o.value || "__all__"}>
                    <button
                      type="button"
                      onClick={() => pick(o.value)}
                      className={`w-full whitespace-nowrap px-3 py-1.5 text-left text-xs hover:bg-gray-50 ${
                        o.value === value ? "bg-red-50 text-red-800" : "text-gray-800"
                      }`}
                    >
                      {o.label}
                    </button>
                  </li>
                ))
              )}
            </ul>,
            document.body
          )
        : null}
    </div>
  );
}
