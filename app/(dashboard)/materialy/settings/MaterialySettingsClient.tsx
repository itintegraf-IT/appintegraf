"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { MaterialCategoryRow } from "@/lib/materialy/categories";

type Sub = {
  id: number;
  category_code: string;
  name: string;
  parent_id: number | null;
  sort_order: number;
  is_active: boolean;
};

export default function MaterialySettingsClient() {
  const [categories, setCategories] = useState<MaterialCategoryRow[]>([]);
  const [category, setCategory] = useState<string>("PAPER");
  const [subs, setSubs] = useState<Sub[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rowBusy, setRowBusy] = useState<number | null>(null);

  const activeLabel = categories.find((c) => c.code === category)?.label ?? category;

  const loadCategories = useCallback(() => {
    void (async () => {
      const r = await fetch("/api/materialy/categories");
      const d = (await r.json().catch(() => ({}))) as { categories?: MaterialCategoryRow[] };
      if (r.ok && Array.isArray(d.categories) && d.categories.length > 0) {
        setCategories(d.categories);
        setCategory((prev) =>
          d.categories!.some((c) => c.code === prev) ? prev : d.categories![0].code
        );
      }
    })();
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const load = useCallback(() => {
    const ac = new AbortController();
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const r = await fetch(
          `/api/materialy/subcategories?category=${encodeURIComponent(category)}`,
          { signal: ac.signal }
        );
        const d = (await r.json().catch(() => ({}))) as {
          subcategories?: Sub[];
          category_code?: string;
          error?: string;
        };
        if (ac.signal.aborted) return;
        if (!r.ok) {
          setSubs([]);
          setError(typeof d.error === "string" ? d.error : "Nelze načíst podtypy");
          return;
        }
        const list = Array.isArray(d.subcategories) ? d.subcategories : [];
        const filtered = list.filter((s) => s.category_code === category);
        if (d.category_code && d.category_code !== category) {
          setSubs([]);
          setError("Odpověď serveru neodpovídá vybrané kategorii.");
          return;
        }
        setSubs(filtered);
      } catch (e) {
        if (ac.signal.aborted) return;
        setSubs([]);
        setError("Chyba při načítání podtypů");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [category]);

  useEffect(() => {
    setSubs([]);
    setName("");
    setError("");
    return load();
  }, [category, load]);

  const selectCategory = (code: string) => {
    if (code === category) return;
    setCategory(code);
  };

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Zadejte název podtypu.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/materialy/subcategories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_code: category,
        name: trimmed,
        sort_order: subs.length,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      subcategory?: Sub;
    };
    setSaving(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Chyba při ukládání");
      return;
    }
    if (data.subcategory && data.subcategory.category_code !== category) {
      setError("Podtyp byl uložen do jiné kategorie — zkuste to znovu.");
      load();
      return;
    }
    setName("");
    load();
  };

  const remove = async (s: Sub) => {
    if (
      !confirm(
        `Smazat podtyp „${s.name}" (${activeLabel})? Pokud je podtyp přiřazen u materiálů, smažení nebude možné — u materiálů nejdřív změňte podtyp.`
      )
    ) {
      return;
    }
    setRowBusy(s.id);
    setError("");
    try {
      const res = await fetch(
        `/api/materialy/subcategories/${s.id}?permanent=1&category=${encodeURIComponent(category)}`,
        { method: "DELETE" }
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Smazání se nezdařilo");
        return;
      }
      load();
    } finally {
      setRowBusy(null);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900">Podtypy materiálu</h2>
      <p className="mb-4 mt-1 text-sm text-gray-600">
        Zvolte skupinu materiálu. Nový podtyp se uloží pouze do aktivní záložky.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => selectCategory(c.code)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              category === c.code
                ? "bg-red-600 text-white shadow-sm"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2">
        <p className="text-sm font-medium text-gray-800">
          Podtypy pro: <span className="text-red-700">{activeLabel}</span>
        </p>
        <p className="text-xs text-gray-500">
          Zde vidíte a přidáváte pouze podtypy této skupiny. V materiálech a v IML se pak nabízejí jen podtypy
          odpovídající kategorie.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Název podtypu pro ${activeLabel.toLowerCase()}…`}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
        />
        <button
          type="button"
          onClick={() => void add()}
          disabled={saving || !name.trim()}
          className="shrink-0 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? "Ukládám…" : "Přidat"}
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-gray-500">Načítání podtypů…</p>
      ) : subs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
          Pro kategorii <strong>{activeLabel}</strong> zatím nemáte žádný podtyp. Přidejte první výše.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border border-gray-200 bg-white">
          {subs.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="font-medium text-gray-900">{s.name}</span>
              <button
                type="button"
                title="Smazat podtyp"
                disabled={rowBusy === s.id}
                onClick={() => void remove(s)}
                className="inline-flex shrink-0 items-center gap-1 text-red-700 hover:text-red-900 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Smazat
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
