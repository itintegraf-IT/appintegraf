"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { QuickCaptureDialog } from "@/components/projekty/todos/QuickCaptureDialog";
import { useIsTouchDevice } from "@/hooks/projekty/useIsTouchDevice";

type QuickCaptureContextValue = { open: () => void };

const QuickCaptureContext = createContext<QuickCaptureContextValue | null>(null);

export function useQuickCapture(): QuickCaptureContextValue {
  const ctx = useContext(QuickCaptureContext);
  if (!ctx) {
    throw new Error("useQuickCapture musí být uvnitř QuickCaptureProvider.");
  }
  return ctx;
}

/**
 * Quick-capture osobního úkolu. Primární cesta je položka v command palette
 * (Ctrl/⌘+K → „Nový osobní úkol"); sekundární zkratka Ctrl/⌘+Shift+U.
 * Ctrl/⌘+K bez shiftu patří paletě (CommandPalette).
 *
 * Proč U a ne K: Ctrl+Shift+K je ve Firefoxu na Windows rezervovaná pro
 * Web Console a preventDefault ji z obsahu stránky nepotlačí.
 */
export function QuickCaptureProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const isTouch = useIsTouchDevice();
  const openCapture = useCallback(() => setOpen(true), []);

  useEffect(() => {
    if (isTouch) return;
    function handler(e: KeyboardEvent) {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === "u"
      ) {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isTouch]);

  return (
    <QuickCaptureContext.Provider value={{ open: openCapture }}>
      {children}
      <QuickCaptureDialog open={open} onOpenChange={setOpen} />
    </QuickCaptureContext.Provider>
  );
}
