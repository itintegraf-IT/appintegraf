"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Layers,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { MachineSelectOptions } from "@/components/shared-machines/MachineSelectOptions";

type SheetType = { id: number; name: string };
type SheetSize = { id: number; name: string };
type PrintMachine = { id: number; name: string; machine_group?: string };
type Item = {
  id: number;
  code: string;
  name: string;
  format_text: string | null;
  note: string | null;
  preview_updated_at: string | null;
  updated_at: string;
  technologie_sheet_types: { id: number; name: string } | null;
  technologie_sheet_sizes: { id: number; name: string } | null;
  shared_machines: { id: number; name: string; machine_group?: string } | null;
};

const SORT_KEYS = [
  "code",
  "name",
  "type",
  "format",
  "sheet_size",
  "machine",
  "note",
] as const;
type SortKey = (typeof SORT_KEYS)[number];
type SortDir = "asc" | "desc";

function isSortKey(value: string): value is SortKey {
  return (SORT_KEYS as readonly string[]).includes(value);
}

function isSortDir(value: string): value is SortDir {
  return value === "asc" || value === "desc";
}

function truncateNote(note: string | null, max = 48): string {
  const t = note?.trim() ?? "";
  if (!t) return "—";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function sortValue(item: Item, key: SortKey): string {
  switch (key) {
    case "code":
      return item.code ?? "";
    case "name":
      return item.name ?? "";
    case "type":
      return item.technologie_sheet_types?.name ?? "";
    case "format":
      return item.format_text ?? "";
    case "sheet_size":
      return item.technologie_sheet_sizes?.name ?? "";
    case "machine":
      return item.shared_machines?.name ?? "";
    case "note":
      return item.note?.trim() ?? "";
  }
}

function compareItems(a: Item, b: Item, key: SortKey, dir: SortDir): number {
  const av = sortValue(a, key);
  const bv = sortValue(b, key);
  const aEmpty = !av;
  const bEmpty = !bv;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  const cmp = av.localeCompare(bv, "cs", { numeric: true, sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
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

function SortableTh({
  label,
  column,
  sortKey,
  sortDir,
  onCycle,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir | null;
  onCycle: (column: SortKey) => void;
}) {
  const active = sortKey === column ? sortDir : null;
  const SortIcon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
  const title =
    active === "asc"
      ? "Řazení: vzestupně (kliknutím sestupně)"
      : active === "desc"
        ? "Řazení: sestupně (kliknutím vypnout)"
        : "Řadit vzestupně";

  return (
    <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">
      <button
        type="button"
        onClick={() => onCycle(column)}
        className={`inline-flex items-center gap-1 hover:text-red-700 ${
          active ? "text-red-700" : "text-gray-700"
        }`}
        title={title}
        aria-label={`${label}: ${title}`}
      >
        {label}
        <SortIcon className={`h-3.5 w-3.5 ${active ? "text-red-700" : "text-gray-400"}`} />
      </button>
    </th>
  );
}

export function TechnologieListClient({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [sheetTypes, setSheetTypes] = useState<SheetType[]>([]);
  const [sheetSizes, setSheetSizes] = useState<SheetSize[]>([]);
  const [printMachines, setPrintMachines] = useState<PrintMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [sheetTypeId, setSheetTypeId] = useState(searchParams.get("sheet_type_id") ?? "");
  const [sheetSizeId, setSheetSizeId] = useState(searchParams.get("sheet_size_id") ?? "");
  const [printMachineId, setPrintMachineId] = useState(
    searchParams.get("print_machine_id") ?? ""
  );

  const sortParam = searchParams.get("sort") ?? "";
  const dirParam = searchParams.get("dir") ?? "";
  const [sortKey, setSortKey] = useState<SortKey | null>(
    isSortKey(sortParam) ? sortParam : null
  );
  const [sortDir, setSortDir] = useState<SortDir | null>(
    isSortKey(sortParam) && isSortDir(dirParam) ? dirParam : null
  );

  const filterQueryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (sheetTypeId) sp.set("sheet_type_id", sheetTypeId);
    if (sheetSizeId) sp.set("sheet_size_id", sheetSizeId);
    if (printMachineId) sp.set("print_machine_id", printMachineId);
    return sp.toString();
  }, [q, sheetTypeId, sheetSizeId, printMachineId]);

  const urlQueryString = useMemo(() => {
    const sp = new URLSearchParams(filterQueryString);
    if (sortKey && sortDir) {
      sp.set("sort", sortKey);
      sp.set("dir", sortDir);
    }
    return sp.toString();
  }, [filterQueryString, sortKey, sortDir]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rItems, rTypes, rSizes, rMach] = await Promise.all([
        fetch(`/api/technologie${filterQueryString ? `?${filterQueryString}` : ""}`),
        fetch("/api/technologie/sheet-types"),
        fetch("/api/technologie/sheet-sizes"),
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
      if (rSizes.ok) {
        const dSizes = (await rSizes.json().catch(() => ({}))) as { items?: SheetSize[] };
        setSheetSizes(Array.isArray(dSizes.items) ? dSizes.items : []);
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
  }, [filterQueryString]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const next = urlQueryString ? `?${urlQueryString}` : "";
    router.replace(`/technologie${next}`, { scroll: false });
  }, [urlQueryString, router]);

  const displayedItems = useMemo(() => {
    if (!sortKey || !sortDir) return items;
    return [...items].sort((a, b) => compareItems(a, b, sortKey, sortDir));
  }, [items, sortKey, sortDir]);

  const onCycleSort = (column: SortKey) => {
    if (sortKey !== column) {
      setSortKey(column);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }
    setSortKey(null);
    setSortDir(null);
  };

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
        className="mb-4 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
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
          <span className="mb-1 block text-gray-600">Velikost archu</span>
          <select
            value={sheetSizeId}
            onChange={(e) => setSheetSizeId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Vše</option>
            {sheetSizes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
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
                <SortableTh
                  label="Kód"
                  column="code"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onCycle={onCycleSort}
                />
                <SortableTh
                  label="Název"
                  column="name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onCycle={onCycleSort}
                />
                <SortableTh
                  label="Typ"
                  column="type"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onCycle={onCycleSort}
                />
                <SortableTh
                  label="Formát"
                  column="format"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onCycle={onCycleSort}
                />
                <SortableTh
                  label="Velikost archu"
                  column="sheet_size"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onCycle={onCycleSort}
                />
                <SortableTh
                  label="Tisk. stroj"
                  column="machine"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onCycle={onCycleSort}
                />
                <SortableTh
                  label="Poznámka"
                  column="note"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onCycle={onCycleSort}
                />
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
              ) : displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-8 text-center text-gray-500">
                    Žádné záznamy
                  </td>
                </tr>
              ) : (
                displayedItems.map((item) => (
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
                      {item.technologie_sheet_sizes?.name ?? "—"}
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
