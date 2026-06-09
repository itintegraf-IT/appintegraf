"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type HiddenActivitiesValue = {
  hide: (id: string) => void;
  unhide: (id: string) => void;
  isHidden: (id: string) => boolean;
};

const Ctx = createContext<HiddenActivitiesValue | null>(null);

export function HiddenActivitiesProvider({ children }: { children: ReactNode }) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const hide = useCallback((id: string) => {
    setHiddenIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const unhide = useCallback((id: string) => {
    setHiddenIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isHidden = useCallback((id: string) => hiddenIds.has(id), [hiddenIds]);

  const value = useMemo<HiddenActivitiesValue>(
    () => ({ hide, unhide, isHidden }),
    [hide, unhide, isHidden],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHiddenActivities(): HiddenActivitiesValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHiddenActivities must be used inside <HiddenActivitiesProvider>");
  return ctx;
}
