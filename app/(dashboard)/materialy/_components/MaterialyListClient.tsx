"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Archive, Trash2 } from "lucide-react";
import type { MaterialFileSummary } from "@/lib/materialy/material-files";
import { MaterialDocumentCell } from "./MaterialDocumentCell";

type Material = {
  id: number;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at?: string;
  issued_at?: string | null;
  valid_until: string | null;
  material_subcategories?: { name: string } | null;
  sds_file?: MaterialFileSummary | null;
  certificate_file?: MaterialFileSummary | null;
};

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("cs-CZ");
}

export function MaterialyListClient({
  category,
  categoryLabel,
  canWrite,
}: {
  category: string;
  categoryLabel?: string;
  canWrite: boolean;
}) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [rowBusy, setRowBusy] = useState<number | null>(null);
  const [listError, setListError] = useState("");

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

  const deactivate = async (m: Material) => {
    setListError("");
    if (
      !confirm(
        `Skrýt „${m.name}“ v katalogu? Záznam zůstane v databázi, přestane se nabízet ve výběrech.`
      )
    ) {
      return;
    }
    setRowBusy(m.id);
    try {
      const r = await fetch(`/api/materialy/${m.id}`, { method: "DELETE" });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        setListError(typeof d.error === "string" ? d.error : "Skrytí se nezdařilo");
        return;
      }
      setMaterials((prev) => prev.filter((x) => x.id !== m.id));
    } finally {
      setRowBusy(null);
    }
  };

  const removePermanent = async (m: Material) => {
    setListError("");
    if (
      !confirm(
        `Trvale smazat „${m.name}“? Tuto akci nelze vrátit. Nahrané dokumenty budou odstraněny. Pokud je materiál použit u produktů IML, smazání nebude možné — použijte „Skrýt“.`
      )
    ) {
      return;
    }
    setRowBusy(m.id);
    try {
      const r = await fetch(`/api/materialy/${m.id}?permanent=1`, { method: "DELETE" });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        setListError(typeof d.error === "string" ? d.error : "Smazání se nezdařilo");
        return;
      }
      setMaterials((prev) => prev.filter((x) => x.id !== m.id));
    } finally {
      setRowBusy(null);
    }
  };

  return (
    <div>
      {listError ? <p className="mb-2 text-sm text-red-600">{listError}</p> : null}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Hledat ve všech údajích (název, kód, výrobce, podtyp…)"
          aria-label={categoryLabel ? `Hledat v kategorii ${categoryLabel}` : "Hledat v katalogu materiálů"}
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
                <th className="px-4 py-2">Datum vložení</th>
                <th className="px-4 py-2">Vystavení</th>
                <th className="px-4 py-2">Platnost</th>
                <th className="px-4 py-2">BL / SDS</th>
                <th className="px-4 py-2">Certifikát</th>
                {canWrite ? <th className="min-w-[11rem] px-4 py-2 text-right">Akce</th> : null}
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
                  <td className="px-4 py-2 text-gray-600">{fmtDate(m.created_at)}</td>
                  <td className="px-4 py-2 text-gray-600">{fmtDate(m.issued_at)}</td>
                  <td className="px-4 py-2 text-gray-600">{fmtDate(m.valid_until)}</td>
                  <td className="px-4 py-2 align-top">
                    <MaterialDocumentCell file={m.sds_file} />
                  </td>
                  <td className="px-4 py-2 align-top">
                    <MaterialDocumentCell file={m.certificate_file} />
                  </td>
                  {canWrite ? (
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/materialy/${m.id}/edit`}
                          className="inline-flex items-center justify-end gap-1 text-red-600 hover:underline"
                          title="Upravit"
                        >
                          <Pencil className="h-4 w-4 shrink-0" />
                          <span className="hidden sm:inline">Upravit</span>
                        </Link>
                        <button
                          type="button"
                          title="Deaktivovat v katalogu"
                          disabled={rowBusy === m.id}
                          onClick={() => void deactivate(m)}
                          className="inline-flex items-center gap-1 text-gray-600 hover:text-red-700 disabled:opacity-50"
                        >
                          <Archive className="h-4 w-4 shrink-0" />
                          <span className="hidden sm:inline">Skrýt</span>
                        </button>
                        <button
                          type="button"
                          title="Trvale smazat"
                          disabled={rowBusy === m.id}
                          onClick={() => void removePermanent(m)}
                          className="inline-flex items-center gap-1 text-red-700 hover:text-red-900 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4 shrink-0" />
                          <span className="hidden sm:inline">Smazat</span>
                        </button>
                      </div>
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
