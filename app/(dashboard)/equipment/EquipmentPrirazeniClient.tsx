"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownAZ, ArrowUpAZ, FileText, LayoutGrid, List, Printer } from "lucide-react";
import type {
  AssignmentSortDir,
  AssignmentSortKey,
  AssignmentView,
} from "@/lib/equipment-assignments-sort";

export type PrirazeniRow = {
  id: number;
  userId: number;
  assignedAt: string;
  userName: string;
  userPosition: string | null;
  userDepartment: string | null;
  equipmentId: number;
  equipmentName: string;
  equipmentBrandModel: string;
  serialNumber: string | null;
  categoryName: string | null;
  ageText: string;
  ageFromRecord: boolean;
};

type Props = {
  rows: PrirazeniRow[];
  seeAll: boolean;
  sort: AssignmentSortKey;
  dir: AssignmentSortDir;
  view: AssignmentView;
};

function buildHref(sort: AssignmentSortKey, dir: AssignmentSortDir, view: AssignmentView) {
  const q = new URLSearchParams();
  if (sort !== "predano") q.set("sort", sort);
  if (dir !== (sort === "predano" ? "desc" : "asc")) q.set("dir", dir);
  if (view !== "table") q.set("view", view);
  const s = q.toString();
  return s ? `/equipment/prirazeni?${s}` : "/equipment/prirazeni";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("cs-CZ");
}

function ProtocolLinks({ row }: { row: PrirazeniRow }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Link
        href={`/equipment/protokol/predani?assignmentId=${row.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50"
        title="Předávací protokol"
      >
        <Printer className="h-3.5 w-3.5" />
        Předání
      </Link>
      <Link
        href={`/equipment/protokol/vraceni?assignmentId=${row.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50"
        title="Protokol o vrácení"
      >
        <FileText className="h-3.5 w-3.5" />
        Vrácení
      </Link>
      <Link href={`/equipment/${row.equipmentId}`} className="text-xs text-gray-500 hover:text-gray-800">
        Detail
      </Link>
    </div>
  );
}

function groupByUser(rows: PrirazeniRow[]) {
  const map = new Map<number, PrirazeniRow[]>();
  for (const row of rows) {
    const list = map.get(row.userId) ?? [];
    list.push(row);
    map.set(row.userId, list);
  }
  return [...map.entries()]
    .map(([userId, items]) => ({
      userId,
      userName: items[0]?.userName ?? "—",
      userPosition: items[0]?.userPosition ?? null,
      userDepartment: items[0]?.userDepartment ?? null,
      items,
    }))
    .sort((a, b) => a.userName.localeCompare(b.userName, "cs", { sensitivity: "base" }));
}

export function EquipmentPrirazeniClient({ rows, seeAll, sort, dir, view }: Props) {
  const router = useRouter();

  const navigate = (nextSort: AssignmentSortKey, nextDir: AssignmentSortDir, nextView: AssignmentView) => {
    router.push(buildHref(nextSort, nextDir, nextView));
  };

  const toggleDir = () => {
    navigate(sort, dir === "asc" ? "desc" : "asc", view);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          Aktivních přiřazení: <strong>{rows.length}</strong>
        </p>
        {seeAll ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <span className="font-medium">Řadit podle:</span>
              <select
                value={sort}
                onChange={(e) => {
                  const next = e.target.value as AssignmentSortKey;
                  const defaultDir: AssignmentSortDir = next === "predano" ? "desc" : "asc";
                  navigate(next, defaultDir, view);
                }}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="predano">Datum předání</option>
                <option value="jmeno">Zaměstnanec</option>
                <option value="nazev">Název</option>
                <option value="skupina">Kategorie</option>
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
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-gray-500">
          Žádná aktivní přiřazení – veškerý majetek je na skladě.
        </div>
      ) : seeAll && view === "cards" ? (
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          {groupByUser(rows).map((group) => (
            <div key={group.userId} className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                <h3 className="font-semibold text-gray-900">{group.userName}</h3>
                <p className="text-sm text-gray-500">
                  {[group.userPosition, group.userDepartment].filter(Boolean).join(" · ") || "—"}
                </p>
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
                        <Link
                          href={`/equipment/${row.equipmentId}`}
                          className="font-medium text-red-700 hover:underline"
                        >
                          {row.equipmentName}
                        </Link>
                        {row.equipmentBrandModel ? (
                          <p className="text-xs text-gray-500">{row.equipmentBrandModel}</p>
                        ) : null}
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                          {row.categoryName ? (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5">{row.categoryName}</span>
                          ) : null}
                          <span className="font-mono">S/N: {row.serialNumber ?? "—"}</span>
                          <span>Stáří: {row.ageText}</span>
                          <span>Předáno: {formatDate(row.assignedAt)}</span>
                        </div>
                      </div>
                      <ProtocolLinks row={row} />
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
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Zaměstnanec</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Vybavení</th>
                {seeAll ? (
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kategorie</th>
                ) : null}
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Sériové č.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stáří</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Předáno</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Protokoly</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{row.userName}</div>
                    {row.userPosition ? <div className="text-xs text-gray-500">{row.userPosition}</div> : null}
                    {row.userDepartment ? (
                      <div className="text-xs text-gray-500">{row.userDepartment}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/equipment/${row.equipmentId}`}
                      className="font-medium text-red-700 hover:underline"
                    >
                      {row.equipmentName}
                    </Link>
                    {row.equipmentBrandModel ? (
                      <div className="text-xs text-gray-500">{row.equipmentBrandModel}</div>
                    ) : null}
                  </td>
                  {seeAll ? (
                    <td className="px-4 py-3 text-sm">{row.categoryName ?? "—"}</td>
                  ) : null}
                  <td className="px-4 py-3 font-mono text-sm">{row.serialNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="text-gray-900">{row.ageText}</div>
                    {row.ageFromRecord ? <div className="text-xs text-gray-500">od zápisu</div> : null}
                  </td>
                  <td className="px-4 py-3 text-sm">{formatDate(row.assignedAt)}</td>
                  <td className="px-4 py-3">
                    <ProtocolLinks row={row} />
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
