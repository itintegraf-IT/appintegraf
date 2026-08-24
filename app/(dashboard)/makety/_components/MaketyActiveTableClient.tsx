"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Filter } from "lucide-react";
import {
  maketaPriorityBadgeClass,
  maketaPriorityLabel,
  maketaStatusBadgeClass,
  maketaStatusLabel,
  prioritySortKey,
} from "@/lib/makety-status";
import { maketyWorkTypeLabel, type MaketyWorkType } from "@/lib/makety-work-type";
import { maketyDataKindLabel } from "@/lib/makety-data-kind";
import { formatDateTimeCz } from "@/lib/datetime-cz";
import {
  type MaketyListColumnId,
  type MaketyListRow,
} from "@/lib/makety/makety-list-columns";
import { useMaketyListColumns } from "@/lib/makety/use-makety-list-columns";
import { MaketyAdminRowActions } from "../MaketyAdminRowActions";
import { CopyMaketaButton } from "../[id]/CopyMaketaButton";
import { MaketyListColumnPicker } from "./MaketyListColumnPicker";
import { MaketyListSortableTableHead } from "./MaketyListSortableTableHead";

type Props = {
  heading: string;
  headingExtra?: string | null;
  rows: MaketyListRow[];
  canModuleAdmin: boolean;
};

type SortDir = "asc" | "desc";
type SortableColumn = "status" | "priority";

const STATUS_SORT_ORDER = [
  "awaiting_quote",
  "quote_submitted",
  "open",
  "in_progress",
  "data_problem",
  "done",
  "prepress_approved",
  "sent_for_approval",
  "approved",
  "cancelled",
];

function dash(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  return value;
}

function statusSortKey(status: string): number {
  const i = STATUS_SORT_ORDER.indexOf(status);
  return i === -1 ? 99 : i;
}

function statusOptionLabel(status: string, rows: MaketyListRow[]): string {
  const hasGrafika = rows.some((r) => r.status === status && r.work_type === "grafika");
  const hasMaketa = rows.some((r) => r.status === status && r.work_type !== "grafika");
  if (hasGrafika && !hasMaketa) return maketaStatusLabel(status, "grafika");
  if (hasMaketa && !hasGrafika) return maketaStatusLabel(status, "maketa");
  const g = maketaStatusLabel(status, "grafika");
  const m = maketaStatusLabel(status, "maketa");
  return g === m ? g : `${g} / ${m}`;
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function SortFilterHeader({
  sortDir,
  onCycleSort,
  filterActive,
  children,
}: {
  sortDir: SortDir | null;
  onCycleSort: () => void;
  filterActive: boolean;
  children: ReactNode;
}) {
  const SortIcon = sortDir === "asc" ? ArrowUp : sortDir === "desc" ? ArrowDown : ArrowUpDown;
  const sortTitle =
    sortDir === "asc"
      ? "Řazení: vzestupně (kliknutím sestupně)"
      : sortDir === "desc"
        ? "Řazení: sestupně (kliknutím vypnout)"
        : "Řadit vzestupně";

  return (
    <div className="flex items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={onCycleSort}
        className={`rounded p-0.5 hover:bg-gray-200 ${
          sortDir ? "text-violet-700" : "text-gray-400 hover:text-gray-600"
        }`}
        title={sortTitle}
        aria-label={sortTitle}
      >
        <SortIcon className="h-3.5 w-3.5" />
      </button>
      <details className="relative">
        <summary
          className={`flex cursor-pointer list-none rounded p-0.5 hover:bg-gray-200 [&::-webkit-details-marker]:hidden ${
            filterActive ? "text-violet-700" : "text-gray-400 hover:text-gray-600"
          }`}
          title={filterActive ? "Filtr je zapnutý" : "Filtrovat"}
        >
          <Filter className="h-3.5 w-3.5" />
        </summary>
        <div className="absolute right-0 z-30 mt-1 min-w-[12rem] rounded-lg border border-gray-200 bg-white p-2 text-left text-xs font-normal text-gray-800 shadow-lg">
          {children}
        </div>
      </details>
    </div>
  );
}

function renderCell(
  columnId: MaketyListColumnId,
  row: MaketyListRow,
  canModuleAdmin: boolean
) {
  switch (columnId) {
    case "due_at":
      return formatDateTimeCz(new Date(row.due_at));
    case "work_type": {
      const wt = (row.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
      return (
        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {maketyWorkTypeLabel(wt)}
        </span>
      );
    }
    case "id":
      return <span className="font-mono text-sm">#{row.id}</span>;
    case "order_number":
      return dash(row.order_number);
    case "body":
      return (
        <Link href={`/makety/${row.id}`} className="font-medium text-violet-600 hover:underline">
          {row.body.replace(/\s+/g, " ").trim().slice(0, 80)}
          {row.body.length > 80 ? "…" : ""}
        </Link>
      );
    case "creator":
      return dash(row.creator_name);
    case "assignee":
      return dash(row.assignee_name);
    case "priority":
      return (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${maketaPriorityBadgeClass(row.priority)}`}
        >
          {maketaPriorityLabel(row.priority)}
        </span>
      );
    case "status": {
      const wt = (row.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
      return (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${maketaStatusBadgeClass(row.status, wt)}`}
        >
          {maketaStatusLabel(row.status, wt)}
        </span>
      );
    }
    case "data_kind": {
      const wt = (row.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
      if (wt !== "grafika") return "—";
      return (
        <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
          {maketyDataKindLabel(row.data_kind)}
        </span>
      );
    }
    case "customer":
      return dash(row.customer_name);
    case "label_code":
      return <span className="font-mono text-sm">{dash(row.label_code)}</span>;
    case "job_number":
      return <span className="font-mono text-sm">{dash(row.job_number)}</span>;
    case "actions":
      return (
        <div className="flex flex-wrap items-center gap-2">
          {row.can_copy && <CopyMaketaButton id={row.id} variant="link" />}
          {row.can_edit && (
            <Link
              href={`/makety/${row.id}/edit`}
              className="text-sm font-medium text-violet-600 hover:underline"
            >
              Upravit
            </Link>
          )}
          {canModuleAdmin ? (
            <MaketyAdminRowActions id={row.id} priority={row.priority} status={row.status} />
          ) : (
            !row.can_edit && !row.can_copy && <span className="text-gray-400">—</span>
          )}
        </div>
      );
    default:
      return "—";
  }
}

export function MaketyActiveTableClient({
  heading,
  headingExtra,
  rows,
  canModuleAdmin,
}: Props) {
  const { visibleColumnIds, visibleColumns, toggleColumn, reorderColumns, resetToDefaults, ready } =
    useMaketyListColumns(canModuleAdmin);

  const [sortBy, setSortBy] = useState<SortableColumn | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);

  const cycleSort = (column: SortableColumn) => {
    if (sortBy !== column) {
      setSortBy(column);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }
    setSortBy(null);
    setSortDir("asc");
  };

  const statusOptions = useMemo(() => {
    const unique = [...new Set(rows.map((r) => r.status))];
    unique.sort((a, b) => statusSortKey(a) - statusSortKey(b));
    return unique;
  }, [rows]);

  const priorityOptions = useMemo(() => {
    const unique = [...new Set(rows.map((r) => r.priority))];
    unique.sort((a, b) => prioritySortKey(a) - prioritySortKey(b));
    return unique;
  }, [rows]);

  const displayedRows = useMemo(() => {
    let next = rows;
    if (statusFilter.length > 0) {
      const set = new Set(statusFilter);
      next = next.filter((r) => set.has(r.status));
    }
    if (priorityFilter.length > 0) {
      const set = new Set(priorityFilter);
      next = next.filter((r) => set.has(r.priority));
    }
    if (!sortBy) return next;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...next].sort((a, b) => {
      const key =
        sortBy === "priority"
          ? prioritySortKey(a.priority) - prioritySortKey(b.priority)
          : statusSortKey(a.status) - statusSortKey(b.status);
      if (key !== 0) return key * dir;
      return a.id - b.id;
    });
  }, [rows, statusFilter, priorityFilter, sortBy, sortDir]);

  const columnExtras = {
    status: (
      <SortFilterHeader
        sortDir={sortBy === "status" ? sortDir : null}
        onCycleSort={() => cycleSort("status")}
        filterActive={statusFilter.length > 0}
      >
        <p className="mb-1.5 font-medium text-gray-600">Filtrovat stav</p>
        {statusOptions.map((status) => (
          <label key={status} className="flex cursor-pointer items-center gap-2 py-0.5">
            <input
              type="checkbox"
              checked={statusFilter.includes(status)}
              onChange={() => setStatusFilter((prev) => toggleValue(prev, status))}
            />
            <span>{statusOptionLabel(status, rows)}</span>
          </label>
        ))}
        {statusFilter.length > 0 && (
          <button
            type="button"
            className="mt-1.5 text-violet-700 hover:underline"
            onClick={() => setStatusFilter([])}
          >
            Zrušit filtr
          </button>
        )}
      </SortFilterHeader>
    ),
    priority: (
      <SortFilterHeader
        sortDir={sortBy === "priority" ? sortDir : null}
        onCycleSort={() => cycleSort("priority")}
        filterActive={priorityFilter.length > 0}
      >
        <p className="mb-1.5 font-medium text-gray-600">Filtrovat prioritu</p>
        {priorityOptions.map((priority) => (
          <label key={priority} className="flex cursor-pointer items-center gap-2 py-0.5">
            <input
              type="checkbox"
              checked={priorityFilter.includes(priority)}
              onChange={() => setPriorityFilter((prev) => toggleValue(prev, priority))}
            />
            <span>{maketaPriorityLabel(priority)}</span>
          </label>
        ))}
        {priorityFilter.length > 0 && (
          <button
            type="button"
            className="mt-1.5 text-violet-700 hover:underline"
            onClick={() => setPriorityFilter([])}
          >
            Zrušit filtr
          </button>
        )}
      </SortFilterHeader>
    ),
  };

  const filterNote =
    statusFilter.length > 0 || priorityFilter.length > 0
      ? ` · zobrazeno ${displayedRows.length} z ${rows.length}`
      : null;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
        <div className="text-sm font-medium text-gray-700">
          {heading}
          {headingExtra ? (
            <span className="ml-2 font-normal text-gray-500">{headingExtra}</span>
          ) : null}
          {filterNote ? (
            <span className="ml-1 font-normal text-gray-500">{filterNote}</span>
          ) : null}
        </div>
        {ready && (
          <MaketyListColumnPicker
            canModuleAdmin={canModuleAdmin}
            visibleColumnIds={visibleColumnIds}
            onToggle={toggleColumn}
            onReorder={reorderColumns}
            onReset={resetToDefaults}
          />
        )}
      </div>
      <table className="min-w-full text-left text-sm">
        {ready ? (
          <MaketyListSortableTableHead
            columns={visibleColumns}
            canModuleAdmin={canModuleAdmin}
            onReorder={reorderColumns}
            columnExtras={columnExtras}
          />
        ) : (
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              {visibleColumns.map((col) => (
                <th key={col.id} className="px-4 py-3 font-semibold text-gray-700">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {displayedRows.length === 0 ? (
            <tr>
              <td
                colSpan={Math.max(visibleColumns.length, 1)}
                className="px-4 py-10 text-center text-gray-500"
              >
                {rows.length === 0
                  ? "Žádné zakázky k zobrazení."
                  : "Žádné zakázky neodpovídají filtru stavu nebo priority."}
              </td>
            </tr>
          ) : (
            displayedRows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                {visibleColumns.map((col) => (
                  <td
                    key={col.id}
                    className={`px-4 py-3 text-gray-800 ${
                      col.id === "body" ? "max-w-xs" : ""
                    }`}
                  >
                    {renderCell(col.id, row, canModuleAdmin)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
