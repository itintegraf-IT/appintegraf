"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatDateTimeLocalForInput } from "@/lib/datetime-cz";
import { ukolStatusLabel } from "@/lib/ukoly-status";

type Dept = { id: number; name: string };
type UserOpt = {
  id: number;
  first_name: string;
  last_name: string;
  department_id: number | null;
  user_secondary_departments: Array<{ department_id: number }>;
};

type Initial = {
  body: string;
  order_number: string | null;
  due_at: string;
  urgent: boolean;
  assignee_user_id: number | null;
  status: string;
  department_ids: number[];
};

type Props = {
  id: number;
  initial: Initial;
  departments: Dept[];
  users: UserOpt[];
};

export function EditUkolForm({ id, initial, departments, users }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>(initial.department_ids);
  const filteredUsers = useMemo(() => {
    if (selectedDepartmentIds.length === 0) return users;
    const base = users.filter((u) => {
      const ids = new Set<number>();
      if (u.department_id) ids.add(u.department_id);
      for (const s of u.user_secondary_departments) ids.add(s.department_id);
      for (const idd of selectedDepartmentIds) {
        if (ids.has(idd)) return true;
      }
      return false;
    });
    if (initial.assignee_user_id != null && !base.some((u) => u.id === initial.assignee_user_id)) {
      const current = users.find((u) => u.id === initial.assignee_user_id);
      if (current) return [current, ...base];
    }
    return base;
  }, [users, selectedDepartmentIds, initial.assignee_user_id]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const department_ids = fd
      .getAll("department_ids")
      .map((v) => parseInt(String(v), 10))
      .filter((n) => !Number.isNaN(n));
    const assigneeRaw = String(fd.get("assignee_user_id") ?? "").trim();
    const body = {
      body: String(fd.get("body") ?? "").trim(),
      order_number: String(fd.get("order_number") ?? "").trim() || null,
      due_at: String(fd.get("due_at") ?? "").trim(),
      urgent: fd.get("urgent") === "true",
      status: String(fd.get("status") ?? "open").trim(),
      assignee_user_id: assigneeRaw ? parseInt(assigneeRaw, 10) : null,
      department_ids,
    };

    try {
      const res = await fetch(`/api/ukoly/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Uložení se nezdařilo");
        setLoading(false);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Síťová chyba");
    }
    setLoading(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
      >
        Upravit úkol
      </button>
    );
  }

  const dueLocal = formatDateTimeLocalForInput(new Date(initial.due_at));

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-gray-900">Úprava úkolu</h3>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <fieldset className="flex flex-wrap gap-3">
          <legend className="mb-2 w-full text-sm font-medium text-gray-700">Oddělení</legend>
          {departments.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="department_ids"
                value={d.id}
                checked={selectedDepartmentIds.includes(d.id)}
                onChange={(e) =>
                  setSelectedDepartmentIds((prev) =>
                    e.target.checked ? [...prev, d.id] : prev.filter((x) => x !== d.id)
                  )
                }
                className="rounded border-gray-300"
              />
              {d.name}
            </label>
          ))}
        </fieldset>
        <div>
          <label className="block text-sm font-medium text-gray-700">Zakázka</label>
          <input
            name="order_number"
            type="text"
            defaultValue={initial.order_number ?? ""}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Úkol</label>
          <textarea
            name="body"
            required
            rows={5}
            defaultValue={initial.body}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Termín splnění</label>
          <input
            name="due_at"
            type="datetime-local"
            required
            defaultValue={dueLocal}
            className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="urgent"
            value="true"
            defaultChecked={initial.urgent}
            className="rounded border-gray-300"
          />
          Urgentní
        </label>
        <div>
          <label className="block text-sm font-medium text-gray-700">Odpovědná osoba</label>
          <select
            name="assignee_user_id"
            defaultValue={initial.assignee_user_id ?? ""}
            className="mt-1 w-full max-w-md rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">— bez konkrétní osoby —</option>
            {filteredUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.last_name} {u.first_name}
              </option>
            ))}
          </select>
          {selectedDepartmentIds.length > 0 && filteredUsers.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">Ve vybraných odděleních nejsou žádní aktivní uživatelé.</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Stav</label>
          <select
            name="status"
            defaultValue={initial.status}
            className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="open">{ukolStatusLabel("open")}</option>
            <option value="in_progress">{ukolStatusLabel("in_progress")}</option>
            <option value="done">{ukolStatusLabel("done")}</option>
            <option value="cancelled">{ukolStatusLabel("cancelled")}</option>
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Ukládám…" : "Uložit"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </button>
        </div>
      </form>
    </div>
  );
}
