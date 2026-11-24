"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MAKETY_ARCHIVE_LIST_COLUMNS_STORAGE_KEY,
  MAKETY_LIST_COLUMNS_PREF_VERSION,
  MAKETY_LIST_COLUMNS_STORAGE_KEY,
  availableMaketyListColumns,
  defaultVisibleMaketyListColumnIds,
  getMaketyListColumnMeta,
  lockedMaketyListColumnIds,
  parseStoredMaketyListColumnPrefs,
  reorderMaketyListColumnIds,
  resolveVisibleMaketyListColumnIds,
  serializeMaketyListColumnPrefs,
  type MaketyListColumnId,
  type MaketyListColumnMeta,
  type MaketyListColumnPrefs,
} from "./makety-list-columns";
import { loadUserUiPref, saveUserUiPref } from "@/lib/user-ui-prefs-client";
import type { UserUiPrefKey } from "@/lib/user-ui-prefs";

export type UseMaketyListColumnsResult = {
  visibleColumnIds: MaketyListColumnId[];
  visibleColumns: MaketyListColumnMeta[];
  isColumnVisible: (id: MaketyListColumnId) => boolean;
  toggleColumn: (id: MaketyListColumnId) => void;
  reorderColumns: (activeId: MaketyListColumnId, overId: MaketyListColumnId) => void;
  resetToDefaults: () => void;
  prefs: MaketyListColumnPrefs;
  ready: boolean;
};

function storageKeyToPrefKey(storageKey: string): UserUiPrefKey {
  if (storageKey === MAKETY_ARCHIVE_LIST_COLUMNS_STORAGE_KEY) {
    return "makety-archive-list-visible-columns";
  }
  return "makety-list-visible-columns";
}

function persistLocal(ids: MaketyListColumnId[], storageKey: string) {
  try {
    localStorage.setItem(storageKey, serializeMaketyListColumnPrefs(ids));
  } catch {
    /* ignore */
  }
}

function persist(
  ids: MaketyListColumnId[],
  storageKey: string,
  prefKey: UserUiPrefKey
) {
  persistLocal(ids, storageKey);
  void saveUserUiPref(prefKey, {
    version: MAKETY_LIST_COLUMNS_PREF_VERSION,
    visibleColumnIds: ids,
  });
}

function prefsValueToIds(
  value: unknown,
  canModuleAdmin: boolean
): MaketyListColumnId[] | null {
  if (!value) return null;
  if (typeof value === "string") {
    return parseStoredMaketyListColumnPrefs(value, canModuleAdmin);
  }
  return parseStoredMaketyListColumnPrefs(JSON.stringify(value), canModuleAdmin);
}

export function useMaketyListColumns(
  canModuleAdmin: boolean,
  storageKey: string = MAKETY_LIST_COLUMNS_STORAGE_KEY
): UseMaketyListColumnsResult {
  const prefKey = storageKeyToPrefKey(storageKey);
  const defaults = useMemo(
    () => defaultVisibleMaketyListColumnIds(canModuleAdmin),
    [canModuleAdmin]
  );
  const [visibleColumnIds, setVisibleColumnIdsState] = useState<MaketyListColumnId[]>(defaults);
  const [ready, setReady] = useState(false);
  const syncDoneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    syncDoneRef.current = false;

    const bootstrap = async () => {
      let localIds: MaketyListColumnId[] | null = null;
      try {
        localIds = parseStoredMaketyListColumnPrefs(
          localStorage.getItem(storageKey),
          canModuleAdmin
        );
      } catch {
        localIds = null;
      }
      if (!cancelled) {
        setVisibleColumnIdsState(localIds ?? defaults);
        setReady(true);
      }

      if (syncDoneRef.current) return;
      syncDoneRef.current = true;

      const remote = await loadUserUiPref(prefKey);
      if (cancelled) return;

      const remoteIds = prefsValueToIds(remote, canModuleAdmin);
      if (remoteIds && remoteIds.length > 0) {
        setVisibleColumnIdsState(remoteIds);
        persistLocal(remoteIds, storageKey);
        return;
      }

      if (localIds && localIds.length > 0) {
        void saveUserUiPref(prefKey, {
          version: MAKETY_LIST_COLUMNS_PREF_VERSION,
          visibleColumnIds: localIds,
        });
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [canModuleAdmin, defaults, prefKey, storageKey]);

  const setVisibleColumnIds = useCallback(
    (ids: MaketyListColumnId[]) => {
      const resolved = resolveVisibleMaketyListColumnIds(ids, canModuleAdmin);
      setVisibleColumnIdsState(resolved);
      persist(resolved, storageKey, prefKey);
    },
    [canModuleAdmin, prefKey, storageKey]
  );

  const toggleColumn = useCallback(
    (id: MaketyListColumnId) => {
      if (lockedMaketyListColumnIds(canModuleAdmin).includes(id)) return;
      if (!availableMaketyListColumns(canModuleAdmin).some((c) => c.id === id)) return;
      setVisibleColumnIdsState((prev) => {
        const has = prev.includes(id);
        const next = has ? prev.filter((x) => x !== id) : [...prev, id];
        const resolved = resolveVisibleMaketyListColumnIds(next, canModuleAdmin);
        persist(resolved, storageKey, prefKey);
        return resolved;
      });
    },
    [canModuleAdmin, prefKey, storageKey]
  );

  const resetToDefaults = useCallback(() => {
    setVisibleColumnIds(defaults);
  }, [defaults, setVisibleColumnIds]);

  const reorderColumns = useCallback(
    (activeId: MaketyListColumnId, overId: MaketyListColumnId) => {
      setVisibleColumnIdsState((prev) => {
        const next = reorderMaketyListColumnIds(prev, activeId, overId, canModuleAdmin);
        persist(next, storageKey, prefKey);
        return next;
      });
    },
    [canModuleAdmin, prefKey, storageKey]
  );

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
      version: MAKETY_LIST_COLUMNS_PREF_VERSION,
      visibleColumnIds: resolveVisibleMaketyListColumnIds(visibleColumnIds, canModuleAdmin),
    }),
    [visibleColumnIds, canModuleAdmin]
  );

  return {
    visibleColumnIds,
    visibleColumns,
    isColumnVisible,
    toggleColumn,
    reorderColumns,
    resetToDefaults,
    prefs,
    ready,
  };
}
