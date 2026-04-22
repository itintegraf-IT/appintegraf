"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, Rows } from "lucide-react";

export type ViewMode = "sections" | "tabs";

const LS_PREFIX = "iml.viewMode.";

/**
 * Hook pro persistentní volbu zobrazení (sekce / záložky) – stav uložen v localStorage
 * pod klíčem `iml.viewMode.<key>`.
 *
 * První render vrací `initial`, aby nedošlo k SSR/CSR mismatch.
 * Po mountu se stav případně přepne na hodnotu z localStorage.
 */
export function useViewMode(
  key: string,
  initial: ViewMode = "sections"
): [ViewMode, (v: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(initial);

  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_PREFIX + key);
      if (v === "tabs" || v === "sections") setMode(v);
    } catch {
      /* ignore */
    }
  }, [key]);

  const update = (v: ViewMode) => {
    setMode(v);
    try {
      localStorage.setItem(LS_PREFIX + key, v);
    } catch {
      /* ignore */
    }
  };

  return [mode, update];
}

/**
 * Vizuální přepínač mezi režimy "sekce pod sebou" a "záložky".
 */
export function ViewToggle({
  mode,
  onChange,
  className = "",
}: {
  mode: ViewMode;
  onChange: (v: ViewMode) => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex rounded-lg border border-gray-300 bg-white p-0.5 ${className}`}
      role="group"
      aria-label="Režim zobrazení"
    >
      <button
        type="button"
        onClick={() => onChange("sections")}
        className={
          mode === "sections"
            ? "inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white"
            : "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
        }
        title="Zobrazit všechny sekce pod sebou"
        aria-pressed={mode === "sections"}
      >
        <Rows className="h-3.5 w-3.5" />
        Sekce
      </button>
      <button
        type="button"
        onClick={() => onChange("tabs")}
        className={
          mode === "tabs"
            ? "inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white"
            : "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
        }
        title="Zobrazit jako záložky (kompaktní)"
        aria-pressed={mode === "tabs"}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Záložky
      </button>
    </div>
  );
}

/**
 * Obecný helper pro render sekcí s volitelnými záložkami.
 * Komponenta `SectionShell` obaluje obsah do hezké karty s názvem/podnázvem (mode "sections"),
 * v módu "tabs" renderuje jen samotný content (hlavička je v Tab labelu).
 */
export function SectionShell({
  title,
  subtitle,
  mode,
  children,
}: {
  title: string;
  subtitle?: string;
  mode: ViewMode;
  children: React.ReactNode;
}) {
  if (mode === "tabs") {
    return <div>{children}</div>;
  }
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-4 border-b border-gray-100 pb-3">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}
