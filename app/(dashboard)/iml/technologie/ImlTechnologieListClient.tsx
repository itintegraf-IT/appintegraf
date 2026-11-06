"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Wrench } from "lucide-react";

type Item = {
  id: number;
  code: string;
  name: string;
  format_text: string | null;
  note: string | null;
  preview_updated_at: string | null;
  technologie_sheet_types: { id: number; name: string } | null;
  technologie_sheet_sizes: { id: number; name: string } | null;
  shared_machines: { id: number; name: string } | null;
};

function truncateNote(note: string | null, max = 48): string {
  const t = note?.trim() ?? "";
  if (!t) return "—";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function PreviewThumb({ id, updatedAt }: { id: number; updatedAt: string | null }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="inline-flex h-12 w-16 items-center justify-center rounded border border-gray-200 bg-gray-50 text-xs text-gray-400">
        —
      </span>
    );
  }
  const q = updatedAt ? `?t=${encodeURIComponent(updatedAt)}` : "";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/technologie/${id}/preview${q}`}
      alt=""
      className="h-12 w-auto max-w-[72px] rounded border border-gray-200 bg-white object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export function ImlTechnologieListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const filterQueryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("is_iml", "1");
    if (q.trim()) sp.set("q", q.trim());
    return sp.toString();
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/technologie?${filterQueryString}`);
      const data = (await res.json().catch(() => ({}))) as {
        items?: Item[];
        error?: string;
      };
      if (!res.ok) {
        setItems([]);
        setError(data.error ?? "Nepodařilo se načíst seznam.");
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError("Chyba při načítání.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filterQueryString]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const next = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    router.replace(`/iml/technologie${next}`, { scroll: false });
  }, [q, router]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Wrench className="h-7 w-7 text-red-600" />
            Technologie IML
          </h1>
          <p className="mt-1 text-gray-600">
            Rozkresy označené jako IML — prohlížení a hledání (bez úprav)
          </p>
        </div>
        <Link
          href="/iml"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Přehled IML
        </Link>
      </div>

      <form
        className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <label className="block max-w-md text-sm">
          <span className="mb-1 block text-gray-600">Hledat (kód, název, formát…)</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
              placeholder="Hledat…"
            />
          </div>
        </label>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px]">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">Kód</th>
                <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">Název</th>
                <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">Typ</th>
                <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">Formát</th>
                <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">
                  Velikost archu
                </th>
                <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">
                  Tisk. stroj
                </th>
                <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">Poznámka</th>
                <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">Náhled</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Načítání…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Žádné IML technologie
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3 text-sm font-mono">
                      <Link
                        href={`/iml/technologie/${item.id}`}
                        className="text-gray-800 hover:text-red-700 hover:underline"
                      >
                        {item.code}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/iml/technologie/${item.id}`}
                        className="font-medium text-red-700 hover:underline"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {item.technologie_sheet_types?.name ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">
                      {item.format_text ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">
                      {item.technologie_sheet_sizes?.name ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">
                      {item.shared_machines?.name ?? "—"}
                    </td>
                    <td className="max-w-[160px] px-3 py-3 text-sm text-gray-500">
                      {truncateNote(item.note)}
                    </td>
                    <td className="px-3 py-3">
                      <PreviewThumb id={item.id} updatedAt={item.preview_updated_at} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
