"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Layers, Pencil, Plus, Search, Settings2, Trash2 } from "lucide-react";
import { MachineSelectOptions } from "@/components/shared-machines/MachineSelectOptions";

type SheetType = { id: number; name: string };
type PrintMachine = { id: number; name: string; machine_group?: string };
type Item = {
  id: number;
  code: string;
  name: string;
  format_text: string | null;
  sheet_size_text: string | null;
  note: string | null;
  preview_updated_at: string | null;
  updated_at: string;
  technologie_sheet_types: { id: number; name: string } | null;
  shared_machines: { id: number; name: string; machine_group?: string } | null;
};

function truncateNote(note: string | null, max = 48): string {
  const t = note?.trim() ?? "";
  if (!t) return "—";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function TechnologiePreviewThumb({ id, updatedAt }: { id: number; updatedAt: string | null }) {
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
      className="h-12 w-auto max-w-[72px] rounded border border-gray-200 object-contain bg-white"
      onError={() => setFailed(true)}
    />
  );
}

export function TechnologieListClient({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [sheetTypes, setSheetTypes] = useState<SheetType[]>([]);
  const [printMachines, setPrintMachines] = useState<PrintMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [sheetTypeId, setSheetTypeId] = useState(searchParams.get("sheet_type_id") ?? "");
  const [printMachineId, setPrintMachineId] = useState(
    searchParams.get("print_machine_id") ?? ""
  );

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (sheetTypeId) sp.set("sheet_type_id", sheetTypeId);
    if (printMachineId) sp.set("print_machine_id", printMachineId);
    return sp.toString();
  }, [q, sheetTypeId, printMachineId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rItems, rTypes, rMach] = await Promise.all([
        fetch(`/api/technologie${queryString ? `?${queryString}` : ""}`),
        fetch("/api/technologie/sheet-types"),
        fetch("/api/shared-machines"),
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

      if (rTypes.ok) {
        const dTypes = (await rTypes.json().catch(() => ({}))) as { items?: SheetType[] };
        setSheetTypes(Array.isArray(dTypes.items) ? dTypes.items : []);
      }
      if (rMach.ok) {
        const dMach = (await rMach.json().catch(() => ({}))) as { machines?: PrintMachine[] };
        setPrintMachines(Array.isArray(dMach.machines) ? dMach.machines : []);
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
    router.replace(`/technologie${next}`, { scroll: false });
  }, [queryString, router]);

  const onDelete = async (item: Item) => {
    if (!confirm(`Trvale smazat rozkres „${item.code} – ${item.name}“ včetně PDF?`)) {
      return;
    }
    setDeletingId(item.id);
    setError("");
    try {
      const res = await fetch(`/api/technologie/${item.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Smazání se nezdařilo.");
        return;
      }
      await load();
      router.refresh();
    } catch {
      setError("Chyba při mazání.");
    } finally {
      setDeletingId(null);
    }
  };

  const colSpan = canWrite ? 9 : 8;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Layers className="h-7 w-7 text-red-600" />
            Technologie
          </h1>
          <p className="mt-1 text-gray-600">Rozkresy tiskových archů (PDF, náhled z 1. stránky)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <>
              <Link
                href="/technologie/ciselniky"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Settings2 className="h-4 w-4" />
                Číselníky
              </Link>
              <Link
                href="/technologie/new"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Nový rozkres
              </Link>
            </>
          )}
        </div>
      </div>

      <form
        className="mb-4 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <label className="block text-sm sm:col-span-2 lg:col-span-1">
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
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">Typ archu</span>
          <select
            value={sheetTypeId}
            onChange={(e) => setSheetTypeId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Vše</option>
            {sheetTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">Tiskový stroj</span>
          <select
            value={printMachineId}
            onChange={(e) => setPrintMachineId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Vše</option>
            <MachineSelectOptions machines={printMachines} />
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
          <table className="w-full min-w-[960px]">
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
                {canWrite && (
                  <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700">Akce</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-8 text-center text-gray-500">
                    Načítání…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-8 text-center text-gray-500">
                    Žádné záznamy
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3 text-sm font-mono">
                      <Link
                        href={`/technologie/${item.id}`}
                        className="text-gray-800 hover:text-red-700 hover:underline"
                      >
                        {item.code}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/technologie/${item.id}`}
                        className="font-medium text-red-700 hover:underline"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {item.technologie_sheet_types?.name ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">{item.format_text ?? "—"}</td>
                    <td className="px-3 py-3 text-sm text-gray-600">
                      {item.sheet_size_text ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">
                      {item.shared_machines?.name ?? "—"}
                    </td>
                    <td className="max-w-[160px] px-3 py-3 text-sm text-gray-500">
                      {truncateNote(item.note)}
                    </td>
                    <td className="px-3 py-3">
                      <TechnologiePreviewThumb
                        id={item.id}
                        updatedAt={item.preview_updated_at}
                      />
                    </td>
                    {canWrite && (
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1">
                          <Link
                            href={`/technologie/${item.id}/edit`}
                            className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                            title="Upravit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Upravit
                          </Link>
                          <button
                            type="button"
                            onClick={() => void onDelete(item)}
                            disabled={deletingId === item.id}
                            className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                            title="Smazat"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {deletingId === item.id ? "…" : "Smazat"}
                          </button>
                        </div>
                      </td>
                    )}
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
