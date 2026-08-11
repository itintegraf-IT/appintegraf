"use client";

import Link from "next/link";
import {
  maketaPriorityBadgeClass,
  maketaPriorityLabel,
  maketaStatusBadgeClass,
  maketaStatusLabel,
} from "@/lib/makety-status";
import { maketyWorkTypeLabel, type MaketyWorkType } from "@/lib/makety-work-type";
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

function dash(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  return value;
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
    case "status":
      return (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${maketaStatusBadgeClass(row.status)}`}
        >
          {maketaStatusLabel(row.status)}
        </span>
      );
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

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
        <div className="text-sm font-medium text-gray-700">
          {heading}
          {headingExtra ? (
            <span className="ml-2 font-normal text-gray-500">{headingExtra}</span>
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
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={Math.max(visibleColumns.length, 1)}
                className="px-4 py-10 text-center text-gray-500"
              >
                Žádné zakázky k zobrazení.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
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
