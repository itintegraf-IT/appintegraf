"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

const SIDEBAR_STATE_KEY = "sidebar-state";

/** expanded = plné menu | rail = lišta s ikonami | pinned = jen ikona Dashboard */
export type SidebarState = "expanded" | "rail" | "pinned";

type SidebarContextType = {
  state: SidebarState;
  collapsed: boolean; // true když rail nebo pinned (pro zpětnou kompatibilitu)
  pinned: boolean; // true když jen ikona
  setState: (state: SidebarState) => void;
  toggleCollapsed: () => void;
  expandToFull: () => void;
};

const SidebarContext = createContext<SidebarContextType | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateInternal] = useState<SidebarState>("expanded");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const stored = localStorage.getItem(SIDEBAR_STATE_KEY);
    if (stored === "rail" || stored === "pinned" || stored === "expanded") {
      setStateInternal(stored);
    }
  }, [mounted]);

  const setState = useCallback((value: SidebarState) => {
    setStateInternal(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(SIDEBAR_STATE_KEY, value);
    }
  }, []);

  /** Cyklus: expanded → rail → pinned → expanded */
  const toggleCollapsed = useCallback(() => {
    setStateInternal((prev) => {
      const next: SidebarState =
        prev === "expanded" ? "rail" : prev === "rail" ? "pinned" : "expanded";
      if (typeof window !== "undefined") {
        localStorage.setItem(SIDEBAR_STATE_KEY, next);
      }
      return next;
    });
  }, []);

  /** Přímý návrat na plné menu (např. klik na ikonu Dashboard při pinned) */
  const expandToFull = useCallback(() => {
    setState("expanded");
  }, []);

  const collapsed = state !== "expanded";
  const pinned = state === "pinned";

  return (
    <SidebarContext.Provider
      value={{ state, collapsed, pinned, setState, toggleCollapsed, expandToFull }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return ctx;
}
