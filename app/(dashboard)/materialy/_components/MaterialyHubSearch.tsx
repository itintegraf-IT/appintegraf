"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MATERIAL_CATEGORIES } from "@/lib/materialy/categories";

type Row = {
  id: number;
  name: string;
  code: string | null;
  category_code: string;
  material_subcategories?: { name: string } | null;
};

function categoryLabel(code: string) {
  return MATERIAL_CATEGORIES.find((c) => c.code === code)?.label ?? code;
}

export function MaterialyHubSearch() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!debounced) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ q: debounced, active: "true" });
    void (async () => {
      try {
        const r = await fetch(`/api/materialy?${params}`);
        const d = (await r.json().catch(() => ({}))) as { materials?: Row[] };
        if (!cancelled) setRows(r.ok && Array.isArray(d.materials) ? d.materials : []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return (
    <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <label htmlFor="materialy-global-q" className="mb-2 block text-sm font-medium text-gray-700">
        Vyhledávání v celém katalogu
      </label>
      <input
        id="materialy-global-q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Název, kód, výrobce, dodavatel, popis, CAS, poznámky, podtyp…"
        className="w-full max-w-xl rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      {loading && <p className="mt-2 text-sm text-gray-500">Hledám…</p>}
      {!loading && debounced && rows.length === 0 && (
        <p className="mt-2 text-sm text-gray-500">Žádné výsledky.</p>
      )}
      {!loading && rows.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2">Kategorie</th>
                <th className="px-3 py-2">Podtyp</th>
                <th className="px-3 py-2">Název</th>
                <th className="px-3 py-2">Kód</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-600">{categoryLabel(m.category_code)}</td>
                  <td className="px-3 py-2 text-gray-600">{m.material_subcategories?.name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Link href={`/materialy/${m.id}`} className="font-medium text-red-600 hover:underline">
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{m.code ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
