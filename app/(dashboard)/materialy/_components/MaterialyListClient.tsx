"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import type { MaterialCategoryCode } from "@/lib/materialy/categories";

type Material = {
  id: number;
  name: string;
  code: string | null;
  is_active: boolean;
  valid_until: string | null;
  certificate_valid_until?: string | null;
  material_subcategories?: { name: string } | null;
};

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("cs-CZ");
}

export function MaterialyListClient({
  category,
  canWrite,
}: {
  category: MaterialCategoryCode;
  canWrite: boolean;
}) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ category, active: "true" });
    if (q.trim()) params.set("q", q.trim());
    void (async () => {
      try {
        const r = await fetch(`/api/materialy?${params}`);
        const d = (await r.json().catch(() => ({}))) as { materials?: Material[] };
        if (!cancelled) setMaterials(r.ok && Array.isArray(d.materials) ? d.materials : []);
      } catch {
        if (!cancelled) setMaterials([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category, q]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Hledat ve všech údajích (název, kód, výrobce, podtyp…)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        {canWrite && (
          <Link
            href={`/materialy/add?category=${category}`}
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Přidat
          </Link>
        )}
        <Link href="/materialy" className="text-sm text-gray-500 hover:text-red-600">
          ← Katalog
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Načítání…</p>
      ) : materials.length === 0 ? (
        <p className="text-sm text-gray-500">Žádné záznamy.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">Název</th>
                <th className="px-4 py-2">Kód</th>
                <th className="px-4 py-2">Podtyp</th>
                <th className="px-4 py-2">Platnost BL / SDS</th>
                <th className="px-4 py-2">Platnost certifikátu</th>
                {canWrite ? <th className="w-28 px-4 py-2 text-right">Akce</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y">
              {materials.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/materialy/${m.id}`} className="font-medium text-red-600 hover:underline">
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{m.code ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-600">{m.material_subcategories?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-600">{fmtDate(m.valid_until)}</td>
                  <td className="px-4 py-2 text-gray-600">{fmtDate(m.certificate_valid_until)}</td>
                  {canWrite ? (
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/materialy/${m.id}/edit`}
                        className="inline-flex items-center justify-end gap-1 text-red-600 hover:underline"
                        title="Upravit"
                      >
                        <Pencil className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Upravit</span>
                      </Link>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
