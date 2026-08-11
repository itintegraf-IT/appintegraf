"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MAKETY_LIST_COLUMNS_STORAGE_KEY,
  availableMaketyListColumns,
  defaultVisibleMaketyListColumnIds,
  getMaketyListColumnMeta,
  lockedMaketyListColumnIds,
  parseStoredMaketyListColumnPrefs,
  resolveVisibleMaketyListColumnIds,
  serializeMaketyListColumnPrefs,
  type MaketyListColumnId,
  type MaketyListColumnMeta,
  type MaketyListColumnPrefs,
} from "./makety-list-columns";

export type UseMaketyListColumnsResult = {
  visibleColumnIds: MaketyListColumnId[];
  visibleColumns: MaketyListColumnMeta[];
  isColumnVisible: (id: MaketyListColumnId) => boolean;
  toggleColumn: (id: MaketyListColumnId) => void;
  resetToDefaults: () => void;
  prefs: MaketyListColumnPrefs;
  ready: boolean;
};

function persist(ids: MaketyListColumnId[]) {
  try {
    localStorage.setItem(MAKETY_LIST_COLUMNS_STORAGE_KEY, serializeMaketyListColumnPrefs(ids));
  } catch {
    /* ignore */
  }
}

export function useMaketyListColumns(canModuleAdmin: boolean): UseMaketyListColumnsResult {
  const defaults = useMemo(
    () => defaultVisibleMaketyListColumnIds(canModuleAdmin),
    [canModuleAdmin]
  );
  const [visibleColumnIds, setVisibleColumnIdsState] = useState<MaketyListColumnId[]>(defaults);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = parseStoredMaketyListColumnPrefs(
        localStorage.getItem(MAKETY_LIST_COLUMNS_STORAGE_KEY),
        canModuleAdmin
      );
      setVisibleColumnIdsState(stored ?? defaults);
    } catch {
      setVisibleColumnIdsState(defaults);
    }
    setReady(true);
  }, [canModuleAdmin, defaults]);

  const setVisibleColumnIds = useCallback(
    (ids: MaketyListColumnId[]) => {
      const resolved = resolveVisibleMaketyListColumnIds(ids, canModuleAdmin);
      setVisibleColumnIdsState(resolved);
      persist(resolved);
    },
    [canModuleAdmin]
  );

  const toggleColumn = useCallback(
    (id: MaketyListColumnId) => {
      if (lockedMaketyListColumnIds(canModuleAdmin).includes(id)) return;
      if (!availableMaketyListColumns(canModuleAdmin).some((c) => c.id === id)) return;
      setVisibleColumnIdsState((prev) => {
        const has = prev.includes(id);
        const next = has ? prev.filter((x) => x !== id) : [...prev, id];
        const resolved = resolveVisibleMaketyListColumnIds(next, canModuleAdmin);
        persist(resolved);
        return resolved;
      });
    },
    [canModuleAdmin]
  );

  const resetToDefaults = useCallback(() => {
    setVisibleColumnIds(defaults);
  }, [defaults, setVisibleColumnIds]);

  const visibleColumns = useMemo(
    () =>
      visibleColumnIds
        .map((id) => getMaketyListColumnMeta(id))
        .filter((c): c is MaketyListColumnMeta => !!c)
        .filter((c) => canModuleAdmin || !c.adminOnly),
    [visibleColumnIds, canModuleAdmin]
  );

  const isColumnVisible = useCallback(
    (id: MaketyListColumnId) => visibleColumnIds.includes(id),
    [visibleColumnIds]
  );

  const prefs = useMemo(
    () => ({
      version: 1 as const,
      visibleColumnIds: resolveVisibleMaketyListColumnIds(visibleColumnIds, canModuleAdmin),
    }),
    [visibleColumnIds, canModuleAdmin]
  );

  return {
    visibleColumnIds,
    visibleColumns,
    isColumnVisible,
    toggleColumn,
    resetToDefaults,
    prefs,
    ready,
  };
}
