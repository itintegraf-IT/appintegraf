"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_VISIBLE_COLUMN_IDS,
  LOCKED_COLUMN_IDS,
  PRODUCT_LIST_COLUMNS,
  PRODUCT_LIST_COLUMNS_STORAGE_KEY,
  applyLegacyThumbnailPref,
  getProductListColumnMeta,
  isKnownProductListColumnId,
  parseStoredColumnPrefs,
  resolveVisibleColumnIds,
  serializeColumnPrefs,
  type ProductListColumnId,
  type ProductListColumnMeta,
  type ProductListColumnPrefs,
} from "./product-list-columns";

export type UseProductListColumnsResult = {
  visibleColumnIds: ProductListColumnId[];
  visibleColumns: ProductListColumnMeta[];
  isColumnVisible: (id: ProductListColumnId) => boolean;
  toggleColumn: (id: ProductListColumnId) => void;
  setVisibleColumnIds: (ids: ProductListColumnId[]) => void;
  resetToDefaults: () => void;
  /** Pro budoucí sync do API – stejný tvar jako localStorage. */
  prefs: ProductListColumnPrefs;
  ready: boolean;
};

function persistColumnIds(ids: ProductListColumnId[]) {
  try {
    localStorage.setItem(PRODUCT_LIST_COLUMNS_STORAGE_KEY, serializeColumnPrefs(ids));
  } catch {
    /* ignore */
  }
}

export function useProductListColumns(): UseProductListColumnsResult {
  const [visibleColumnIds, setVisibleColumnIdsState] = useState<ProductListColumnId[]>(
    DEFAULT_VISIBLE_COLUMN_IDS
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = parseStoredColumnPrefs(localStorage.getItem(PRODUCT_LIST_COLUMNS_STORAGE_KEY));
      const withLegacy = applyLegacyThumbnailPref(stored ?? DEFAULT_VISIBLE_COLUMN_IDS);
      setVisibleColumnIdsState(withLegacy);
    } catch {
      setVisibleColumnIdsState(DEFAULT_VISIBLE_COLUMN_IDS);
    }
    setReady(true);
  }, []);

  const setVisibleColumnIds = useCallback((ids: ProductListColumnId[]) => {
    const resolved = resolveVisibleColumnIds(ids);
    setVisibleColumnIdsState(resolved);
    persistColumnIds(resolved);
  }, []);

  const toggleColumn = useCallback(
    (id: ProductListColumnId) => {
      if (LOCKED_COLUMN_IDS.includes(id)) return;
      setVisibleColumnIdsState((prev) => {
        const has = prev.includes(id);
        const next = has ? prev.filter((x) => x !== id) : [...prev, id];
        const resolved = resolveVisibleColumnIds(next);
        persistColumnIds(resolved);
        return resolved;
      });
    },
    []
  );

  const resetToDefaults = useCallback(() => {
    setVisibleColumnIds(DEFAULT_VISIBLE_COLUMN_IDS);
  }, [setVisibleColumnIds]);

  const visibleColumns = useMemo(
    () =>
      visibleColumnIds
        .map((id) => getProductListColumnMeta(id))
        .filter((c): c is ProductListColumnMeta => !!c),
    [visibleColumnIds]
  );

  const isColumnVisible = useCallback(
    (id: ProductListColumnId) => visibleColumnIds.includes(id),
    [visibleColumnIds]
  );

  const prefs = useMemo(
    () => ({
      version: 1 as const,
      visibleColumnIds: resolveVisibleColumnIds(visibleColumnIds),
    }),
    [visibleColumnIds]
  );

  return {
    visibleColumnIds,
    visibleColumns,
    isColumnVisible,
    toggleColumn,
    setVisibleColumnIds,
    resetToDefaults,
    prefs,
    ready,
  };
}

export { isKnownProductListColumnId };
