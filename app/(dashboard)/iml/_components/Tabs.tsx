"use client";

import { useEffect, useState } from "react";

export type TabDef = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  badge?: string | number | null;
  hidden?: boolean;
};

/**
 * Lehké záložky bez externí závislosti.
 *
 * - Jediná aktivní záložka, stav držen v useState.
 * - Volitelný parametr `storageKey` persistuje aktivní tab v localStorage
 *   (např. aby po reloadu zůstala stejná záložka).
 * - Skryté taby (`hidden: true`) se nerenderují.
 */
export function Tabs({
  tabs,
  defaultId,
  storageKey,
  className = "",
}: {
  tabs: TabDef[];
  defaultId?: string;
  storageKey?: string;
  className?: string;
}) {
  const visible = tabs.filter((t) => !t.hidden);
  const fallback = defaultId ?? visible[0]?.id ?? "";
  const [active, setActive] = useState<string>(fallback);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const v = localStorage.getItem(`iml.activeTab.${storageKey}`);
      if (v && visible.some((t) => t.id === v)) setActive(v);
    } catch {
      /* ignore */
    }
  }, [storageKey, visible]);

  const handleChange = (id: string) => {
    setActive(id);
    if (storageKey) {
      try {
        localStorage.setItem(`iml.activeTab.${storageKey}`, id);
      } catch {
        /* ignore */
      }
    }
  };

  const activeTab = visible.find((t) => t.id === active) ?? visible[0];
  if (!activeTab) return null;

  return (
    <div className={className}>
      <div
        className="flex flex-wrap gap-0.5 border-b border-gray-200"
        role="tablist"
      >
        {visible.map((t) => {
          const isActive = t.id === activeTab.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleChange(t.id)}
              className={
                isActive
                  ? "inline-flex items-center gap-1.5 border-b-2 border-red-600 px-4 py-2 text-sm font-medium text-red-700"
                  : "inline-flex items-center gap-1.5 border-b-2 border-transparent px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              }
            >
              {t.icon}
              <span>{t.label}</span>
              {t.badge != null && t.badge !== "" && (
                <span
                  className={
                    isActive
                      ? "rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-700"
                      : "rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700"
                  }
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="mt-4">
        {activeTab.content}
      </div>
    </div>
  );
}
