"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronDown, Lightbulb } from "lucide-react";
import type { TroubleCategory } from "@/lib/helpdesk/parse-trouble-kb";

type FlatEntry = {
  category: string;
  problem: string;
  solutionSteps: string[];
  tip?: string;
  causes?: string;
  symptoms?: string;
  id: string;
};

function flattenCategories(categories: TroubleCategory[]): FlatEntry[] {
  const out: FlatEntry[] = [];
  for (const cat of categories) {
    for (let i = 0; i < cat.entries.length; i++) {
      const e = cat.entries[i];
      out.push({
        category: cat.name,
        problem: e.problem,
        solutionSteps: e.solutionSteps,
        tip: e.tip,
        causes: e.causes,
        symptoms: e.symptoms,
        id: `${cat.name}-${i}`,
      });
    }
  }
  return out;
}

export function ReseniProblemuTab({ categories }: { categories: TroubleCategory[] }) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allEntries = useMemo(() => flattenCategories(categories), [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allEntries.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (!q) return true;
      const haystack = [
        e.problem,
        e.category,
        ...e.solutionSteps,
        e.tip ?? "",
        e.causes ?? "",
        e.symptoms ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [allEntries, categoryFilter, search]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Zkuste nejdřív řešení níže. Pokud nepomůže, založte ticket v záložce{" "}
        <Link href="/pozadavky?tab=helpdesk" className="font-medium underline hover:text-blue-950">
          Helpdesk
        </Link>
        .
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat problém nebo řešení…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm"
          />
        </div>
        <p className="text-sm text-gray-500">
          {filtered.length} {filtered.length === 1 ? "záznam" : filtered.length < 5 ? "záznamy" : "záznamů"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoryFilter("all")}
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            categoryFilter === "all"
              ? "bg-red-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Vše
        </button>
        {categories.map((cat) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => setCategoryFilter(cat.name)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              categoryFilter === cat.name
                ? "bg-red-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">Žádný problém neodpovídá hledání.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className={`rounded-xl border bg-white shadow-sm ${
                expandedId === entry.id ? "border-red-300 ring-1 ring-red-200" : "border-gray-200"
              }`}
            >
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                className="flex w-full items-start justify-between gap-3 p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <span className="mb-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {entry.category}
                  </span>
                  <p className="font-medium text-gray-900">{entry.problem}</p>
                </div>
                <ChevronDown
                  className={`mt-1 h-5 w-5 shrink-0 text-gray-400 transition-transform ${
                    expandedId === entry.id ? "rotate-180" : ""
                  }`}
                />
              </button>

              {expandedId === entry.id && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                  {(entry.causes || entry.symptoms) && (
                    <div className="mb-4 space-y-2 text-sm text-gray-600">
                      {entry.causes && (
                        <p>
                          <span className="font-medium text-gray-700">Možné příčiny: </span>
                          {entry.causes}
                        </p>
                      )}
                      {entry.symptoms && (
                        <p>
                          <span className="font-medium text-gray-700">Příznaky: </span>
                          {entry.symptoms}
                        </p>
                      )}
                    </div>
                  )}
                  <p className="mb-2 text-sm font-medium text-gray-700">Postup řešení</p>
                  <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-800">
                    {entry.solutionSteps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                  {entry.tip && (
                    <div className="mt-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-medium">Tip</p>
                        <p>{entry.tip}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
