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
 * (Ctrl/⌘+K → „Nový osobní úkol"); sekundární zkratka Ctrl/⌘+Shift+K.
 * Ctrl/⌘+K bez shiftu patří paletě (CommandPalette).
 */
export function QuickCaptureProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openCapture = useCallback(() => setOpen(true), []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "k") {
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
  }, []);

  return (
    <QuickCaptureContext.Provider value={{ open: openCapture }}>
      {children}
      <QuickCaptureDialog open={open} onOpenChange={setOpen} />
    </QuickCaptureContext.Provider>
  );
}
