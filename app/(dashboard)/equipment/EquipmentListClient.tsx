"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownAZ, ArrowUpAZ, LayoutGrid, List } from "lucide-react";
import type {
  EquipmentListSortDir,
  EquipmentListSortKey,
  EquipmentListView,
} from "@/lib/equipment-list-sort";
import { EquipmentTableActions } from "./EquipmentTableActions";
import { isEquipmentAssignedStatus } from "@/lib/equipment-status";

export type EquipmentListRow = {
  id: number;
  name: string;
  brandModel: string;
  serialNumber: string | null;
  categoryName: string | null;
  status: string | null;
  assignedToName: string | null;
  assignedToUserId: number | null;
  assignmentId: number | null;
  purchaseDate: string | null;
  ageText: string;
  ageFromRecord: boolean;
};

type Props = {
  rows: EquipmentListRow[];
  sort: EquipmentListSortKey;
  dir: EquipmentListSortDir;
  view: EquipmentListView;
  canEdit: boolean;
  canAssign: boolean;
  canDelete: boolean;
};

function buildHref(sort: EquipmentListSortKey, dir: EquipmentListSortDir, view: EquipmentListView) {
  const q = new URLSearchParams();
  q.set("scope", "all");
  if (sort !== "zapis") q.set("sort", sort);
  if (dir !== (sort === "zapis" ? "desc" : "asc")) q.set("dir", dir);
  if (view !== "table") q.set("view", view);
  return `/equipment?${q.toString()}`;
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("cs-CZ") : "-";
}

function groupByUser(rows: EquipmentListRow[]) {
  const map = new Map<string, EquipmentListRow[]>();
  for (const row of rows) {
    const key = row.assignedToUserId != null ? String(row.assignedToUserId) : "__none__";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([key, items]) => ({
      key,
      userName: key === "__none__" ? "Nepřiřazeno" : items[0]?.assignedToName ?? "—",
      items,
    }))
    .sort((a, b) => {
      if (a.key === "__none__") return 1;
      if (b.key === "__none__") return -1;
      return a.userName.localeCompare(b.userName, "cs", { sensitivity: "base" });
    });
}

export function EquipmentListClient({
  rows,
  sort,
  dir,
  view,
  canEdit,
  canAssign,
  canDelete,
}: Props) {
  const router = useRouter();

  const navigate = (nextSort: EquipmentListSortKey, nextDir: EquipmentListSortDir, nextView: EquipmentListView) => {
    router.push(buildHref(nextSort, nextDir, nextView));
  };

  const toggleDir = () => {
    navigate(sort, dir === "asc" ? "desc" : "asc", view);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          Položek vybavení: <strong>{rows.length}</strong>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <span className="font-medium">Řadit podle:</span>
            <select
              value={sort}
              onChange={(e) => {
                const next = e.target.value as EquipmentListSortKey;
                const defaultDir: EquipmentListSortDir = next === "zapis" ? "desc" : "asc";
                navigate(next, defaultDir, view);
              }}
              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="zapis">Zápis (ID)</option>
              <option value="nazev">Název</option>
              <option value="znacka">Značka / Model</option>
              <option value="kategorie">Kategorie</option>
              <option value="uzivatel">Uživatel</option>
            </select>
          </label>
          <button
            type="button"
            onClick={toggleDir}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            title={dir === "asc" ? "Vzestupně" : "Sestupně"}
          >
            {dir === "asc" ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
            {dir === "asc" ? "Vzestupně" : "Sestupně"}
          </button>
          <div className="flex rounded-lg border border-gray-200 bg-white p-1">
            <button
              type="button"
              onClick={() => navigate(sort, dir, "table")}
              className={`flex items-center gap-1 rounded px-3 py-1 text-sm ${
                view === "table" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <List className="h-4 w-4" />
              Seznam
            </button>
            <button
              type="button"
              onClick={() => navigate(sort, dir, "cards")}
              className={`flex items-center gap-1 rounded px-3 py-1 text-sm ${
                view === "cards" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Karty
            </button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-gray-500">Žádné vybavení</div>
      ) : view === "cards" ? (
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          {groupByUser(rows).map((group) => (
            <div key={group.key} className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                <h3 className="font-semibold text-gray-900">{group.userName}</h3>
                <p className="mt-1 text-xs text-gray-500">
                  {group.items.length}{" "}
                  {group.items.length === 1 ? "položka" : group.items.length < 5 ? "položky" : "položek"}
                </p>
              </div>
              <ul className="divide-y divide-gray-100">
                {group.items.map((row) => (
                  <li key={row.id} className="px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <Link href={`/equipment/${row.id}`} className="font-medium text-red-700 hover:underline">
                          {row.name}
                        </Link>
                        {row.brandModel ? <p className="text-xs text-gray-500">{row.brandModel}</p> : null}
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                          {row.categoryName ? (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5">{row.categoryName}</span>
                          ) : null}
                          <span className="font-mono">S/N: {row.serialNumber ?? "—"}</span>
                          <span className="rounded bg-gray-100 px-1.5 py-0.5">{row.status ?? "—"}</span>
                          <span>Stáří: {row.ageText}</span>
                          <span>Nákup: {formatDate(row.purchaseDate)}</span>
                        </div>
                      </div>
                      <EquipmentTableActions
                        equipmentId={row.id}
                        assignmentId={row.assignmentId}
                        canEdit={canEdit}
                        canAssign={canAssign}
                        canDelete={canDelete}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Název</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Značka / Model</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Sériové č.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kategorie</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nákup</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stáří</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Akce</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-3">{row.brandModel || "-"}</td>
                  <td className="px-4 py-3 font-mono text-sm">{row.serialNumber ?? "-"}</td>
                  <td className="px-4 py-3">{row.categoryName ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="w-fit rounded bg-gray-100 px-2 py-0.5 text-sm">{row.status ?? "-"}</span>
                      {row.assignedToName || isEquipmentAssignedStatus(row.status) ? (
                        <span className="max-w-[14rem] text-xs leading-snug text-gray-600">
                          <span className="text-gray-400">Uživatel: </span>
                          {row.assignedToName ?? "—"}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatDate(row.purchaseDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-gray-900">{row.ageText}</span>
                      {row.ageFromRecord ? (
                        <span className="text-xs text-gray-500">od zápisu (chybí nákup)</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <EquipmentTableActions
                      equipmentId={row.id}
                      assignmentId={row.assignmentId}
                      canEdit={canEdit}
                      canAssign={canAssign}
                      canDelete={canDelete}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
