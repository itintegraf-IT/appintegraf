"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, List, CalendarRange } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Props = {
  initialQuery?: string;
  showList?: boolean;
};

export function CalendarSearch({ initialQuery = "", showList = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const applySearch = useCallback(
    (q: string) => {
      const p = new URLSearchParams(searchParams.toString());
      const trimmed = q.trim();
      if (trimmed) {
        p.set("q", trimmed);
      } else {
        p.delete("q");
      }
      p.delete("display");
      router.push(`/calendar?${p}`);
    },
    [router, searchParams]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applySearch(query);
  };

  const handleClear = () => {
    setQuery("");
    applySearch("");
  };

  const listUrl = () => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("display");
    return `/calendar?${p}`;
  };

  const calendarUrl = () => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("display", "calendar");
    return `/calendar?${p}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hledat události, lidi..."
          className="w-full min-w-[200px] max-w-[320px] rounded-lg border border-gray-300 py-2 pl-9 pr-9 text-sm placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          aria-label="Vyhledávání v kalendáři"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Zrušit vyhledávání"
            aria-label="Zrušit vyhledávání"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>
      {query && (
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          <Link
            href={listUrl()}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              showList ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <List className="h-4 w-4" />
            Seznam
          </Link>
          <Link
            href={calendarUrl()}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              !showList ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <CalendarRange className="h-4 w-4" />
            Kalendář
          </Link>
        </div>
      )}
    </div>
  );
}
