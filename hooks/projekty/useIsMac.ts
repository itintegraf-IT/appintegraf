"use client";

import { useEffect, useState } from "react";
import { detectIsMac } from "@/lib/projekty/platform";

/**
 * SSR-safe detekce macu pro zobrazení zkratek (⌘ vs. Ctrl).
 * Na serveru i při prvním klientském renderu vrací false (= Ctrl varianta,
 * appka běží převážně na Windows) — stejný vzor jako useIsTouchDevice.
 */
export function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(detectIsMac());
  }, []);
  return isMac;
}
