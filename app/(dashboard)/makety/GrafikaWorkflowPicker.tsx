"use client";

import type { MaketyWorkType } from "@/lib/makety-work-type";

export type WorkflowUserOpt = {
  id: number;
  first_name: string;
  last_name: string;
};

export type GrafikaWorkflowInitial = {
  assignee_user_id: number | null;
  prepress_user_id: number | null;
  final_approver_user_id: number | null;
};

type Props = {
  creatorName: string;
  grafikUsers: WorkflowUserOpt[];
  prepressUsers: WorkflowUserOpt[];
  finalUsers: WorkflowUserOpt[];
  initial?: GrafikaWorkflowInitial;
  /** edit mode – include assignee select here instead of separate field */
  includeAssignee?: boolean;
  mode?: "edit" | "readonly";
  currentStatus?: string;
  /** Pro readonly, pokud uživatel není v seznamu rolí */
  assigneeDisplayName?: string | null;
  prepressDisplayName?: string | null;
  finalDisplayName?: string | null;
};

function userLabel(u: WorkflowUserOpt): string {
  return `${u.last_name} ${u.first_name}`;
}

function stepActiveClass(active: boolean, accent: string): string {
  if (active) return accent;
  return "border-gray-200 bg-white text-gray-700";
}

/** Který krok workflow je „aktuální“ podle stavu zakázky. */
export function grafikaWorkflowActiveStep(
  status: string | undefined
): "zadavatel" | "grafik" | "prepress" | "final" | "done" {
  switch (status) {
    case "open":
    case "in_progress":
      return "grafik";
    case "data_problem":
      return "zadavatel";
    case "done":
      return "prepress";
    case "prepress_approved":
    case "sent_for_approval":
      return "final";
    case "approved":
      return "done";
    default:
      return "zadavatel";
  }
}

export function GrafikaWorkflowPicker({
  creatorName,
  grafikUsers,
  prepressUsers,
  finalUsers,
  initial,
  includeAssignee = true,
  mode = "edit",
  currentStatus,
  assigneeDisplayName,
  prepressDisplayName,
  finalDisplayName,
}: Props) {
  const readonly = mode === "readonly";
  const active = grafikaWorkflowActiveStep(currentStatus);

  const assigneeId = initial?.assignee_user_id;
  const prepressId = initial?.prepress_user_id;
  const finalId = initial?.final_approver_user_id;

  const assigneeName =
    assigneeDisplayName ||
    (grafikUsers.find((u) => u.id === assigneeId)
      ? userLabel(grafikUsers.find((u) => u.id === assigneeId)!)
      : null);
  const prepressName =
    prepressDisplayName ||
    (prepressUsers.find((u) => u.id === prepressId)
      ? userLabel(prepressUsers.find((u) => u.id === prepressId)!)
      : null);
  const finalName =
    finalDisplayName ||
    (finalUsers.find((u) => u.id === finalId)
      ? userLabel(finalUsers.find((u) => u.id === finalId)!)
      : null);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Workflow grafiky</h3>
      <p className="mt-1 text-xs text-gray-500">
        Zadavatel → grafik → schvalovatel prepress → finální schvalovatel
      </p>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-2">
        <div
          className={`flex-1 rounded-lg border px-3 py-3 ${stepActiveClass(
            active === "zadavatel",
            "border-yellow-400 bg-yellow-50 text-yellow-900"
          )}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">1. Zadavatel</p>
          <p className="mt-1 text-sm font-medium">{creatorName}</p>
        </div>

        <div className="hidden items-center text-gray-300 lg:flex">→</div>

        <div
          className={`flex-1 rounded-lg border px-3 py-3 ${stepActiveClass(
            active === "grafik",
            "border-orange-400 bg-orange-50 text-orange-900"
          )}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            2. Grafik *
          </p>
          {readonly ? (
            <p className="mt-1 text-sm font-medium">{assigneeName ?? "—"}</p>
          ) : includeAssignee ? (
            <select
              name="assignee_user_id"
              required
              disabled={grafikUsers.length === 0}
              defaultValue={assigneeId ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
            >
              <option value="">— vyberte —</option>
              {grafikUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {userLabel(u)}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 text-sm text-gray-500">Viz pole Grafika níže</p>
          )}
        </div>

        <div className="hidden items-center text-gray-300 lg:flex">→</div>

        <div
          className={`flex-1 rounded-lg border px-3 py-3 ${stepActiveClass(
            active === "prepress",
            "border-green-400 bg-green-50 text-green-900"
          )}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            3. Prepress *
          </p>
          {readonly ? (
            <p className="mt-1 text-sm font-medium">{prepressName ?? "—"}</p>
          ) : (
            <select
              name="prepress_user_id"
              required
              disabled={prepressUsers.length === 0}
              defaultValue={prepressId ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
            >
              <option value="">— vyberte —</option>
              {prepressUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {userLabel(u)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="hidden items-center text-gray-300 lg:flex">→</div>

        <div
          className={`flex-1 rounded-lg border px-3 py-3 ${stepActiveClass(
            active === "final" || active === "done",
            active === "done"
              ? "border-green-600 bg-green-100 text-green-900"
              : "border-blue-400 bg-blue-50 text-blue-900"
          )}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            4. Finální *
          </p>
          {readonly ? (
            <p className="mt-1 text-sm font-medium">{finalName ?? "—"}</p>
          ) : (
            <select
              name="final_approver_user_id"
              required
              disabled={finalUsers.length === 0}
              defaultValue={finalId ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
            >
              <option value="">— vyberte —</option>
              {finalUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {userLabel(u)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {!readonly && (prepressUsers.length === 0 || finalUsers.length === 0) && (
        <p className="mt-3 text-xs text-amber-800">
          V administraci přiřaďte uživatelům role „Schvalovatel prepress“ a „Finální schvalovatel
          grafiky“.
        </p>
      )}
    </div>
  );
}

/** Unused type re-export for callers that need workType gating. */
export type { MaketyWorkType };
