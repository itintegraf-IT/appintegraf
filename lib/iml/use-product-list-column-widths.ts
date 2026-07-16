"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PRODUCT_LIST_COLUMN_WIDTHS_STORAGE_KEY,
  clampColumnWidth,
  getDefaultColumnWidth,
  parseStoredColumnWidths,
  resolveColumnWidths,
  serializeColumnWidths,
  type ProductListColumnId,
  type ProductListColumnWidths,
} from "./product-list-columns";

export type UseProductListColumnWidthsResult = {
  columnWidths: ProductListColumnWidths;
  getWidth: (id: ProductListColumnId) => number;
  setWidth: (id: ProductListColumnId, px: number) => void;
  resetWidth: (id: ProductListColumnId) => void;
  resetWidths: () => void;
  ready: boolean;
};

function persistWidths(widths: ProductListColumnWidths) {
  try {
    localStorage.setItem(PRODUCT_LIST_COLUMN_WIDTHS_STORAGE_KEY, serializeColumnWidths(widths));
  } catch {
    /* ignore */
  }
}

export function useProductListColumnWidths(
  visibleColumnIds: ProductListColumnId[]
): UseProductListColumnWidthsResult {
  const [storedWidths, setStoredWidths] = useState<ProductListColumnWidths | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const parsed = parseStoredColumnWidths(
        localStorage.getItem(PRODUCT_LIST_COLUMN_WIDTHS_STORAGE_KEY)
      );
      setStoredWidths(parsed);
    } catch {
      setStoredWidths(null);
    }
    setReady(true);
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
      persistWidths(next);
      return next;
    });
  }, []);

  const resetWidth = useCallback((id: ProductListColumnId) => {
    setStoredWidths((prev) => {
      const next = { ...(prev ?? {}) };
      delete next[id];
      if (Object.keys(next).length === 0) {
        try {
          localStorage.removeItem(PRODUCT_LIST_COLUMN_WIDTHS_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        return null;
      }
      persistWidths(next);
      return next;
    });
  }, []);

  const resetWidths = useCallback(() => {
    setStoredWidths(null);
    try {
      localStorage.removeItem(PRODUCT_LIST_COLUMN_WIDTHS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
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
