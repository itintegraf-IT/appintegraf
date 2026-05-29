"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { MaterialCategoryRow } from "@/lib/materialy/categories";

export function MaterialyCategorySettings() {
  const [categories, setCategories] = useState<MaterialCategoryRow[]>([]);
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const r = await fetch("/api/materialy/categories");
        const d = (await r.json().catch(() => ({}))) as {
          categories?: MaterialCategoryRow[];
          error?: string;
        };
        if (!r.ok) {
          setCategories([]);
          setError(typeof d.error === "string" ? d.error : "Nelze načíst skupiny");
          return;
        }
        setCategories(Array.isArray(d.categories) ? d.categories : []);
      } catch {
        setCategories([]);
        setError("Chyba při načítání skupin");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError("Zadejte název skupiny.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/materialy/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: trimmedLabel,
        code: code.trim() || undefined,
        slug: slug.trim() || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Uložení se nezdařilo");
      return;
    }
    setLabel("");
    setCode("");
    setSlug("");
    load();
  };

  return (
    <section className="mb-10 rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-gray-900">Skupiny materiálů</h2>
      <p className="mt-1 text-sm text-gray-600">
        Přidejte novou skupinu (např. lepidla, pásky). Kód se doplní automaticky z názvu, pokud ho nevyplníte.
        Skupina se objeví v katalogu i ve výběru kategorie u materiálu.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="mb-0.5 block text-xs font-medium text-gray-600">Název skupiny *</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="např. Lepidla"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-xs font-medium text-gray-600">Kód (volitelně)</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="LEPIDLA"
            maxLength={20}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-xs font-medium text-gray-600">URL slug (volitelně)</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="lepidla"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void add()}
          disabled={saving || !label.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {saving ? "Ukládám…" : "Přidat skupinu"}
        </button>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Načítání skupin…</p>
      ) : (
        <ul className="mt-4 divide-y rounded-lg border border-gray-200">
          {categories.map((c) => (
            <li key={c.code} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span>
                <span className="font-medium text-gray-900">{c.label}</span>
                <span className="ml-2 font-mono text-xs text-gray-500">{c.code}</span>
              </span>
              <Link
                href={`/materialy/kategorie/${c.slug}`}
                className="text-red-600 hover:underline"
              >
                Otevřít katalog →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
