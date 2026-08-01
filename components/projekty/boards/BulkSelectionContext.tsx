"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ContextValue = {
  selectedIds: Set<string>;
  count: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
  selectRange: (fromId: string, toId: string, orderedIds: string[]) => void;
  clear: () => void;
  /** ID karty naposledy individuálně selectované — anchor pro shift-range */
  lastSelectedId: string | null;
};

const BulkSelectionCtx = createContext<ContextValue | null>(null);

export function BulkSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setLastSelectedId(id);
  }, []);

  const add = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setLastSelectedId(id);
  }, []);

  const remove = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const selectRange = useCallback(
    (fromId: string, toId: string, orderedIds: string[]) => {
      const fromIdx = orderedIds.indexOf(fromId);
      const toIdx = orderedIds.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1) return;
      const [start, end] =
        fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          // start/end jsou validní indexy z indexOf — prvek vždy existuje
          next.add(orderedIds[i]!);
        }
        return next;
      });
      setLastSelectedId(toId);
    },
    [],
  );

  const clear = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  // Esc → clear. Guard: neruš výběr, když Esc obsluhuje otevřený dialog
  // (command palette, detail karty, potvrzovací dialogy — Radix nastavuje
  // role="dialog" + data-state="open" na content).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      clear();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clear]);

  const value = useMemo<ContextValue>(
    () => ({
      selectedIds,
      count: selectedIds.size,
      isSelected: (id: string) => selectedIds.has(id),
      toggle,
      add,
      remove,
      selectRange,
      clear,
      lastSelectedId,
    }),
    [selectedIds, lastSelectedId, toggle, add, remove, selectRange, clear],
  );

  return (
    <BulkSelectionCtx.Provider value={value}>
      {children}
    </BulkSelectionCtx.Provider>
  );
}

export function useBulkSelection(): ContextValue {
  const ctx = useContext(BulkSelectionCtx);
  if (!ctx) {
    throw new Error("useBulkSelection must be used within BulkSelectionProvider");
  }
  return ctx;
}
