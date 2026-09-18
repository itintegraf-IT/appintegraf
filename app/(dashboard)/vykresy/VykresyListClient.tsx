"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Cuboid, Plus, Search, Settings2 } from "lucide-react";
import {
  VYKRESY_DOCUMENT_KINDS,
  VYKRESY_DOCUMENT_KIND_LABELS,
  type VykresyDocumentKind,
} from "@/lib/vykresy/constants";

type Department = { id: number; name: string };
type Machine = { id: number; name: string };
type Item = {
  id: number;
  name: string;
  document_kind: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  departments: { id: number; name: string } | null;
  vykresy_machines: { id: number; name: string } | null;
  users_created_by: { first_name: string; last_name: string };
};

function kindLabel(kind: string): string {
  if (kind in VYKRESY_DOCUMENT_KIND_LABELS) {
    return VYKRESY_DOCUMENT_KIND_LABELS[kind as VykresyDocumentKind];
  }
  return kind;
}

export function VykresyListClient({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [documentKind, setDocumentKind] = useState(searchParams.get("document_kind") ?? "");
  const [departmentId, setDepartmentId] = useState(searchParams.get("department_id") ?? "");
  const [machineId, setMachineId] = useState(searchParams.get("machine_id") ?? "");

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (documentKind) sp.set("document_kind", documentKind);
    if (departmentId) sp.set("department_id", departmentId);
    if (machineId) sp.set("machine_id", machineId);
    return sp.toString();
  }, [q, documentKind, departmentId, machineId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rItems, rDep, rMach] = await Promise.all([
        fetch(`/api/vykresy${queryString ? `?${queryString}` : ""}`),
        fetch("/api/departments"),
        fetch("/api/vykresy/machines"),
      ]);
      const dItems = (await rItems.json().catch(() => ({}))) as {
        items?: Item[];
        error?: string;
      };
      if (!rItems.ok) {
        setItems([]);
        setError(dItems.error ?? "Nepodařilo se načíst seznam.");
        return;
      }
      setItems(Array.isArray(dItems.items) ? dItems.items : []);

      if (rDep.ok) {
        const dDep = await rDep.json().catch(() => null);
        const list = Array.isArray(dDep) ? dDep : dDep?.departments;
        if (Array.isArray(list)) {
          setDepartments(
            list.map((d: Department) => ({ id: d.id, name: d.name })).filter((d: Department) => d.id)
          );
        }
      }
      if (rMach.ok) {
        const dMach = (await rMach.json().catch(() => ({}))) as { machines?: Machine[] };
        setMachines(Array.isArray(dMach.machines) ? dMach.machines : []);
      }
    } catch {
      setError("Chyba při načítání.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const next = queryString ? `?${queryString}` : "";
    router.replace(`/vykresy${next}`, { scroll: false });
  }, [queryString, router]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Cuboid className="h-7 w-7 text-red-600" />
            Technické výkresy
          </h1>
          <p className="mt-1 text-gray-600">
            Evidence CAD výkresů, PDF a 3D modelů (STL, 3MF, …)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <>
              <Link
                href="/vykresy/stroje"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Settings2 className="h-4 w-4" />
                Stroje
              </Link>
              <Link
                href="/vykresy/new"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Nový záznam
              </Link>
            </>
          )}
        </div>
      </div>

      <form
        className="mb-4 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">Název</span>
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
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">Typ</span>
          <select
            value={documentKind}
            onChange={(e) => setDocumentKind(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Vše</option>
            {VYKRESY_DOCUMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {VYKRESY_DOCUMENT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">Oddělení</span>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Vše</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">Stroj</span>
          <select
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Vše</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Název</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Typ</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Oddělení</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stroj</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Upraveno</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Načítání…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Žádné záznamy
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/vykresy/${item.id}`}
                        className="font-medium text-red-700 hover:underline"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {kindLabel(item.document_kind)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.departments?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.vykresy_machines?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(item.updated_at).toLocaleString("cs-CZ")}
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
