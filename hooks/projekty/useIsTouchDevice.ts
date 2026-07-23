"use client";

import { useEffect, useState } from "react";

/**
 * Vrací true pokud je primární input touch (mobile, tablet).
 * SSR-safe: vrátí false na server side a první render klientu.
 * Reaguje na změnu (např. iPad připojený k externí myši).
 *
 * Použít místo useMediaQuery('(max-width: 768px)') pro feature gating
 * který by měl být driven typem inputu, ne viewportem (iPad landscape je
 * 1024px ale stále touch).
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(pointer: coarse)");
    setIsTouch(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isTouch;
}
