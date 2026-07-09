"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type ListFilterValues = Record<string, string>;

type UseListFiltersOptions = {
  /** Výchozí hodnoty filtrů (prázdný řetězec = bez filtru v URL). */
  defaults: ListFilterValues;
  /** Klíče, u kterých změna resetuje stránku na 1. */
  resetPageOnChange?: string[];
  pageKey?: string;
};

/**
 * Synchronizuje filtry seznamu s URL query parametry.
 * URL je zdroj pravdy – vhodné pro návrat ze detailu přes returnTo / historii.
 */
export function useListFilters({
  defaults,
  resetPageOnChange,
  pageKey = "page",
}: UseListFiltersOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => {
    const out: ListFilterValues = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const fromUrl = searchParams.get(key);
      if (fromUrl != null) out[key] = fromUrl;
    }
    return out;
  }, [searchParams, defaults]);

  const buildListHref = useCallback(
    (overrides?: Partial<ListFilterValues>) => {
      const merged = { ...filters, ...overrides };
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(merged)) {
        const def = defaults[key] ?? "";
        if (value && value !== def) {
          params.set(key, value);
        }
      }
      const q = params.toString();
      return q ? `${pathname}?${q}` : pathname;
    },
    [filters, pathname, defaults]
  );

  const listHref = buildListHref();

  const setFilters = useCallback(
    (updates: Partial<ListFilterValues>) => {
      const next = { ...filters, ...updates };
      if (resetPageOnChange?.some((k) => k in updates) && pageKey in defaults) {
        next[pageKey] = "1";
      }
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(next)) {
        const def = defaults[key] ?? "";
        if (value && value !== def) params.set(key, value);
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [filters, defaults, pathname, router, resetPageOnChange, pageKey]
  );

  const setFilter = useCallback(
    (key: string, value: string) => {
      setFilters({ [key]: value });
    },
    [setFilters]
  );

  return { filters, setFilter, setFilters, listHref, buildListHref };
}
