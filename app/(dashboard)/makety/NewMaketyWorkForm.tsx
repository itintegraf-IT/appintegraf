"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTimeCz, formatDateTimeLocalForInput } from "@/lib/datetime-cz";
import {
  maketyAssigneeRoleLabel,
  maketyWorkTypeLabel,
  type MaketyWorkType,
} from "@/lib/makety-work-type";
import { GrafikaImlFields } from "./GrafikaImlFields";
import { GrafikaWorkflowPicker, type WorkflowUserOpt } from "./GrafikaWorkflowPicker";

type UserOpt = WorkflowUserOpt;

type Props = {
  workType: MaketyWorkType;
  assigneeUsers: UserOpt[];
  creatorName?: string;
  prepressUsers?: UserOpt[];
  finalUsers?: UserOpt[];
};

export function NewMaketyWorkForm({
  workType,
  assigneeUsers,
  creatorName = "Já",
  prepressUsers = [],
  finalUsers = [],
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const typeLabel = maketyWorkTypeLabel(workType);
  const roleLabel = maketyAssigneeRoleLabel(workType);
  const submitLabel = workType === "grafika" ? "Zapsat grafiku" : "Zapsat maketu";
  const createdQuery = workType === "grafika" ? "grafika_created=1" : "created=1";
  const isGrafika = workType === "grafika";

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const res = await fetch("/api/makety", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Uložení se nezdařilo");
        setLoading(false);
        return;
      }
      const newId = data.id as number | undefined;
      router.push(newId ? `/makety/${newId}?upload=1` : `/makety?${createdQuery}`);
      router.refresh();
    } catch {
      setError("Síťová chyba");
    }
    setLoading(false);
  };

  const nowLocal = new Date();
  const defaultDue = new Date(nowLocal.getTime() + 24 * 60 * 60 * 1000);
  const dueDefault = formatDateTimeLocalForInput(defaultDue);

  const canSubmitGrafika =
    !isGrafika ||
    (assigneeUsers.length > 0 && prepressUsers.length > 0 && finalUsers.length > 0);

  return (
    <form onSubmit={onSubmit} className="max-w-4xl space-y-6">
      <input type="hidden" name="work_type" value={workType} />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {assigneeUsers.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          V systému není žádný aktivní uživatel s rolí „{roleLabel}“. Přiřaďte tuto úroveň v
          administraci uživatelům.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Interní označení / číslo
          </label>
          <input
            name="order_number"
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Volitelné (interní reference)"
          />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-gray-700">Priorita</label>
          <select
            name="priority"
            defaultValue="normal"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="normal">Normální</option>
            <option value="high">Vysoká</option>
            <option value="urgent">Urgentní</option>
          </select>
        </div>
        {isGrafika && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="mb-1 block text-sm font-medium text-gray-700">Typ dat</label>
            <select
              name="data_kind"
              defaultValue="nova_data"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="nova_data">nová data</option>
              <option value="uprava_dat">úprava dat</option>
            </select>
          </div>
        )}
      </div>

      {isGrafika && (
        <GrafikaWorkflowPicker
          creatorName={creatorName}
          grafikUsers={assigneeUsers}
          prepressUsers={prepressUsers}
          finalUsers={finalUsers}
          includeAssignee
        />
      )}

      {isGrafika && <GrafikaImlFields />}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Popis zakázky ({typeLabel}) *
        </label>
        <textarea
          name="body"
          required
          rows={14}
          className="min-h-[280px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Popis práce, postup, poznámky… (podklady lze přidat jako přílohy po uložení)"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Datum zadání</label>
            <p className="text-sm text-gray-600">
              {formatDateTimeCz(nowLocal)}
              <span className="mt-1 block text-xs text-gray-400">Automaticky při uložení</span>
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Termín dokončení *</label>
            <input
              name="due_at"
              type="datetime-local"
              required
              defaultValue={dueDefault}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Počet kusů</label>
            <input
              name="quantity"
              type="number"
              min={1}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Volitelné"
            />
          </div>
        </div>
      </div>

      {!isGrafika && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-gray-700">{roleLabel} *</label>
          <select
            name="assignee_user_id"
            required
            disabled={assigneeUsers.length === 0}
            className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">— vyberte —</option>
            {assigneeUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.last_name} {u.first_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="text-sm text-gray-500">
        Dokumentaci (PDF, Word, Excel, obrázky, e-mail .eml/.msg) nahrajete na detailu zakázky po
        uložení — lze nahrát více souborů najednou.
      </p>

      <div className="flex justify-center">
        <button
          type="submit"
          disabled={loading || assigneeUsers.length === 0 || !canSubmitGrafika}
          className="rounded-lg bg-violet-600 px-8 py-2.5 font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {loading ? "Ukládám…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
