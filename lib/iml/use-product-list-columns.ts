"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_VISIBLE_COLUMN_IDS,
  LOCKED_COLUMN_IDS,
  PRODUCT_LIST_COLUMNS,
  PRODUCT_LIST_COLUMNS_PREF_KEY,
  PRODUCT_LIST_COLUMNS_STORAGE_KEY,
  applyLegacyThumbnailPref,
  getProductListColumnMeta,
  isKnownProductListColumnId,
  parseStoredColumnPrefs,
  reorderVisibleColumnIds,
  resolveVisibleColumnIds,
  serializeColumnPrefs,
  type ProductListColumnId,
  type ProductListColumnMeta,
  type ProductListColumnPrefs,
} from "./product-list-columns";
import { loadUserUiPref, saveUserUiPref } from "@/lib/user-ui-prefs-client";

export type UseProductListColumnsResult = {
  visibleColumnIds: ProductListColumnId[];
  visibleColumns: ProductListColumnMeta[];
  isColumnVisible: (id: ProductListColumnId) => boolean;
  toggleColumn: (id: ProductListColumnId) => void;
  setVisibleColumnIds: (ids: ProductListColumnId[]) => void;
  reorderColumns: (activeId: ProductListColumnId, overId: ProductListColumnId) => void;
  resetToDefaults: () => void;
  prefs: ProductListColumnPrefs;
  ready: boolean;
};

function persistColumnIdsLocal(ids: ProductListColumnId[]) {
  try {
    localStorage.setItem(PRODUCT_LIST_COLUMNS_STORAGE_KEY, serializeColumnPrefs(ids));
  } catch {
    /* ignore */
  }
}

function persistColumnIds(ids: ProductListColumnId[]) {
  persistColumnIdsLocal(ids);
  void saveUserUiPref(PRODUCT_LIST_COLUMNS_PREF_KEY, {
    version: 1,
    visibleColumnIds: ids,
  });
}

function prefsValueToIds(value: unknown): ProductListColumnId[] | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return parseStoredColumnPrefs(JSON.stringify(value));
  }
  if (typeof value === "object") {
    return parseStoredColumnPrefs(JSON.stringify(value));
  }
  if (typeof value === "string") {
    return parseStoredColumnPrefs(value);
  }
  return null;
}

export function useProductListColumns(): UseProductListColumnsResult {
  const [visibleColumnIds, setVisibleColumnIdsState] = useState<ProductListColumnId[]>(
    DEFAULT_VISIBLE_COLUMN_IDS
  );
  const [ready, setReady] = useState(false);
  const syncDoneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      let localIds: ProductListColumnId[] | null = null;
      try {
        localIds = parseStoredColumnPrefs(
          localStorage.getItem(PRODUCT_LIST_COLUMNS_STORAGE_KEY)
        );
      } catch {
        localIds = null;
      }
      const localResolved = applyLegacyThumbnailPref(localIds ?? DEFAULT_VISIBLE_COLUMN_IDS);
      if (!cancelled) {
        setVisibleColumnIdsState(localResolved);
        setReady(true);
      }

      if (syncDoneRef.current) return;
      syncDoneRef.current = true;

      const remote = await loadUserUiPref(PRODUCT_LIST_COLUMNS_PREF_KEY);
      if (cancelled) return;

      const remoteIds = prefsValueToIds(remote);
      if (remoteIds && remoteIds.length > 0) {
        const resolved = applyLegacyThumbnailPref(remoteIds);
        setVisibleColumnIdsState(resolved);
        persistColumnIdsLocal(resolved);
        return;
      }

      if (localIds && localIds.length > 0) {
        const resolved = applyLegacyThumbnailPref(localIds);
        void saveUserUiPref(PRODUCT_LIST_COLUMNS_PREF_KEY, {
          version: 1,
          visibleColumnIds: resolved,
        });
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const setVisibleColumnIds = useCallback((ids: ProductListColumnId[]) => {
    const resolved = resolveVisibleColumnIds(ids);
    setVisibleColumnIdsState(resolved);
    persistColumnIds(resolved);
  }, []);

  const toggleColumn = useCallback((id: ProductListColumnId) => {
    if (LOCKED_COLUMN_IDS.includes(id)) return;
    setVisibleColumnIdsState((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((x) => x !== id) : [...prev, id];
      const resolved = resolveVisibleColumnIds(next);
      persistColumnIds(resolved);
      return resolved;
    });
  }, []);

  const reorderColumns = useCallback(
    (activeId: ProductListColumnId, overId: ProductListColumnId) => {
      setVisibleColumnIdsState((prev) => {
        const next = reorderVisibleColumnIds(prev, activeId, overId);
        persistColumnIds(next);
        return next;
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
    reorderColumns,
    resetToDefaults,
    prefs,
    ready,
  };
}

export { isKnownProductListColumnId, PRODUCT_LIST_COLUMNS };
