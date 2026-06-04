"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTimeLocalForInput } from "@/lib/datetime-cz";
import {
  maketyAssigneeRoleLabel,
  maketyWorkTypeLabel,
  type MaketyWorkType,
} from "@/lib/makety-work-type";

type UserOpt = {
  id: number;
  first_name: string;
  last_name: string;
};

export type EditMaketyInitial = {
  body: string;
  order_number: string | null;
  priority: string;
  due_at: Date;
  quantity: number | null;
  assignee_user_id: number | null;
};

type Props = {
  maketaId: number;
  workType: MaketyWorkType;
  assigneeUsers: UserOpt[];
  initial: EditMaketyInitial;
};

export function EditMaketyWorkForm({ maketaId, workType, assigneeUsers, initial }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const typeLabel = maketyWorkTypeLabel(workType);
  const roleLabel = maketyAssigneeRoleLabel(workType);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const fd = new FormData(form);

    const quantityRaw = String(fd.get("quantity") ?? "").trim();
    const payload: Record<string, unknown> = {
      body: String(fd.get("body") ?? "").trim(),
      order_number: String(fd.get("order_number") ?? "").trim() || null,
      priority: String(fd.get("priority") ?? "normal"),
      due_at: String(fd.get("due_at") ?? "").trim(),
      assignee_user_id: parseInt(String(fd.get("assignee_user_id") ?? ""), 10),
      quantity: quantityRaw ? parseInt(quantityRaw, 10) : null,
    };

    try {
      const res = await fetch(`/api/makety/${maketaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Uložení se nezdařilo");
        setLoading(false);
        return;
      }
      router.push(`/makety/${maketaId}`);
      router.refresh();
    } catch {
      setError("Síťová chyba");
    }
    setLoading(false);
  };

  const dueDefault = formatDateTimeLocalForInput(new Date(initial.due_at));

  return (
    <form onSubmit={onSubmit} className="max-w-4xl space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {assigneeUsers.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          V systému není žádný aktivní uživatel s rolí „{roleLabel}“.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-gray-700">Číslo zakázky</label>
          <input
            name="order_number"
            type="text"
            defaultValue={initial.order_number ?? ""}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Volitelné"
          />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-gray-700">Priorita</label>
          <select
            name="priority"
            defaultValue={initial.priority}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="normal">Normální</option>
            <option value="high">Vysoká</option>
            <option value="urgent">Urgentní</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Popis zakázky ({typeLabel}) *
        </label>
        <textarea
          name="body"
          required
          rows={14}
          defaultValue={initial.body}
          className="min-h-[280px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
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
              defaultValue={initial.quantity ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Volitelné"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-gray-700">{roleLabel} *</label>
        <select
          name="assignee_user_id"
          required
          disabled={assigneeUsers.length === 0}
          defaultValue={initial.assignee_user_id ?? ""}
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

      <p className="text-sm text-gray-500">
        Přílohy upravíte na detailu zakázky po uložení.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="submit"
          disabled={loading || assigneeUsers.length === 0}
          className="rounded-lg bg-violet-600 px-8 py-2.5 font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {loading ? "Ukládám…" : "Uložit změny"}
        </button>
        <Link
          href={`/makety/${maketaId}`}
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Zrušit
        </Link>
      </div>
    </form>
  );
}
