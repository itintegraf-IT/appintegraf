"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Dept = { id: number; name: string };
type UserOpt = {
  id: number;
  first_name: string;
  last_name: string;
  department_id: number | null;
  user_secondary_departments: Array<{ department_id: number }>;
};

type Props = {
  departments: Dept[];
  users: UserOpt[];
};

export function NewUkolForm({ departments, users }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>([]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const res = await fetch("/api/ukoly", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Uložení se nezdařilo");
        setLoading(false);
        return;
      }
      router.push(`/ukoly?created=1`);
      router.refresh();
    } catch {
      setError("Síťová chyba");
    }
    setLoading(false);
  };

  const nowLocal = new Date();
  const defaultDue = new Date(nowLocal.getTime() + 24 * 60 * 60 * 1000);
  const dueDefault = defaultDue.toISOString().slice(0, 16);

  const filteredUsers = useMemo(() => {
    if (selectedDepartmentIds.length === 0) return users;
    return users.filter((u) => {
      const ids = new Set<number>();
      if (u.department_id) ids.add(u.department_id);
      for (const s of u.user_secondary_departments) ids.add(s.department_id);
      for (const id of selectedDepartmentIds) {
        if (ids.has(id)) return true;
      }
      return false;
    });
  }, [users, selectedDepartmentIds]);

  return (
    <form onSubmit={onSubmit} className="max-w-4xl space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <fieldset className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <legend className="px-2 text-sm font-medium text-gray-700">Oddělení</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {departments.map((d) => (
            <label key={d.id} className="flex cursor-pointer items-center gap-2 text-sm">
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
        </div>
        <p className="mt-2 text-xs text-gray-500">Vyberte alespoň jedno oddělení a/nebo konkrétního uživatele níže.</p>
      </fieldset>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-gray-700">K zakázce číslo</label>
        <div>
          <input
            name="order_number"
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Volitelné"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-gray-700">Zadaný úkol *</label>
        <div>
          <textarea
            name="body"
            required
            rows={6}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Popis úkolu"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-gray-700">Datum zadání</label>
        <div className="text-sm text-gray-600">
          {nowLocal.toLocaleString("cs-CZ", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          <span className="text-gray-400">(nastaveno automaticky při uložení)</span>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-gray-700">Termín pro splnění úkolu *</label>
        <div className="space-y-3">
          <input
            name="due_at"
            type="datetime-local"
            required
            defaultValue={dueDefault}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="urgent" value="true" className="rounded border-gray-300" />
            Splnit obratem / ihned
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-gray-700">Kdo zodpovídá za splnění úkolu</label>
        <div>
          <select
            name="assignee_user_id"
            className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">— bez konkrétní osoby (jen oddělení) —</option>
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
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Příloha (Word, Excel, PDF, obrázek JPG/PNG)
        </label>
        <div>
          <input
            name="attachment"
            type="file"
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
        </div>
      </div>

      <div className="flex justify-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-red-600 px-8 py-2.5 font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {loading ? "Ukládám…" : "Zapsat"}
        </button>
      </div>
    </form>
  );
}
