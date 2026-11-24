"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PRODUCT_LIST_COLUMN_WIDTHS_PREF_KEY,
  PRODUCT_LIST_COLUMN_WIDTHS_STORAGE_KEY,
  clampColumnWidth,
  getDefaultColumnWidth,
  parseStoredColumnWidths,
  resolveColumnWidths,
  serializeColumnWidths,
  type ProductListColumnId,
  type ProductListColumnWidths,
} from "./product-list-columns";
import {
  createDebouncedUiPrefSaver,
  loadUserUiPref,
  saveUserUiPref,
} from "@/lib/user-ui-prefs-client";

export type UseProductListColumnWidthsResult = {
  columnWidths: ProductListColumnWidths;
  getWidth: (id: ProductListColumnId) => number;
  setWidth: (id: ProductListColumnId, px: number) => void;
  resetWidth: (id: ProductListColumnId) => void;
  resetWidths: () => void;
  ready: boolean;
};

function persistWidthsLocal(widths: ProductListColumnWidths) {
  try {
    localStorage.setItem(PRODUCT_LIST_COLUMN_WIDTHS_STORAGE_KEY, serializeColumnWidths(widths));
  } catch {
    /* ignore */
  }
}

function clearWidthsLocal() {
  try {
    localStorage.removeItem(PRODUCT_LIST_COLUMN_WIDTHS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function prefsValueToWidths(value: unknown): ProductListColumnWidths | null {
  if (!value) return null;
  if (typeof value === "string") return parseStoredColumnWidths(value);
  if (typeof value === "object" && !Array.isArray(value)) {
    return parseStoredColumnWidths(JSON.stringify(value));
  }
  return null;
}

export function useProductListColumnWidths(
  visibleColumnIds: ProductListColumnId[]
): UseProductListColumnWidthsResult {
  const [storedWidths, setStoredWidths] = useState<ProductListColumnWidths | null>(null);
  const [ready, setReady] = useState(false);
  const syncDoneRef = useRef(false);
  const debouncedSaver = useRef(createDebouncedUiPrefSaver(400));

  useEffect(() => {
    const saver = debouncedSaver.current;
    return () => saver.cancel();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      let local: ProductListColumnWidths | null = null;
      try {
        local = parseStoredColumnWidths(
          localStorage.getItem(PRODUCT_LIST_COLUMN_WIDTHS_STORAGE_KEY)
        );
      } catch {
        local = null;
      }
      if (!cancelled) {
        setStoredWidths(local);
        setReady(true);
      }

      if (syncDoneRef.current) return;
      syncDoneRef.current = true;

      const remote = await loadUserUiPref(PRODUCT_LIST_COLUMN_WIDTHS_PREF_KEY);
      if (cancelled) return;

      const remoteWidths = prefsValueToWidths(remote);
      if (remoteWidths && Object.keys(remoteWidths).length > 0) {
        setStoredWidths(remoteWidths);
        persistWidthsLocal(remoteWidths);
        return;
      }

      if (local && Object.keys(local).length > 0) {
        void saveUserUiPref(PRODUCT_LIST_COLUMN_WIDTHS_PREF_KEY, local);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const columnWidths = useMemo(
    () => resolveColumnWidths(visibleColumnIds, storedWidths),
    [visibleColumnIds, storedWidths]
  );

  const getWidth = useCallback(
    (id: ProductListColumnId) => columnWidths[id] ?? getDefaultColumnWidth(id),
    [columnWidths]
  );

  const setWidth = useCallback((id: ProductListColumnId, px: number) => {
    const clamped = clampColumnWidth(id, px);
    setStoredWidths((prev) => {
      const base = prev ?? {};
      const next = { ...base, [id]: clamped };
      persistWidthsLocal(next);
      debouncedSaver.current.schedule(PRODUCT_LIST_COLUMN_WIDTHS_PREF_KEY, next);
      return next;
    });
  }, []);

  const resetWidth = useCallback((id: ProductListColumnId) => {
    setStoredWidths((prev) => {
      const next = { ...(prev ?? {}) };
      delete next[id];
      if (Object.keys(next).length === 0) {
        clearWidthsLocal();
        void saveUserUiPref(PRODUCT_LIST_COLUMN_WIDTHS_PREF_KEY, null);
        return null;
      }
      persistWidthsLocal(next);
      void saveUserUiPref(PRODUCT_LIST_COLUMN_WIDTHS_PREF_KEY, next);
      return next;
    });
  }, []);

  const resetWidths = useCallback(() => {
    setStoredWidths(null);
    clearWidthsLocal();
    void saveUserUiPref(PRODUCT_LIST_COLUMN_WIDTHS_PREF_KEY, null);
  }, []);

  return {
    columnWidths,
    getWidth,
    setWidth,
    resetWidth,
    resetWidths,
    ready,
  };
}
