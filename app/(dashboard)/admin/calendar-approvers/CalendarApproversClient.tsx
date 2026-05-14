"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: number; first_name: string; last_name: string };

type ApproverConfig = {
  id: number;
  primary_user_id: number;
  secondary_user_id: number | null;
  tertiary_user_id: number | null;
  users_primary: User;
  users_secondary: User | null;
  users_tertiary: User | null;
};

type DepartmentRow = {
  id: number;
  name: string;
  code: string | null;
  manager_id: number | null;
  users: User | null;
  calendar_department_approvers: ApproverConfig | null;
};

type FormState = {
  primary_user_id: string;
  secondary_user_id: string;
  tertiary_user_id: string;
};

function emptyForm(): FormState {
  return { primary_user_id: "", secondary_user_id: "", tertiary_user_id: "" };
}

function formFromConfig(config: ApproverConfig | null): FormState {
  if (!config) return emptyForm();
  return {
    primary_user_id: String(config.primary_user_id),
    secondary_user_id: config.secondary_user_id ? String(config.secondary_user_id) : "",
    tertiary_user_id: config.tertiary_user_id ? String(config.tertiary_user_id) : "",
  };
}

function userLabel(u: User) {
  return `${u.first_name} ${u.last_name}`;
}

export function CalendarApproversClient({ departments }: { departments: DepartmentRow[] }) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [forms, setForms] = useState<Record<number, FormState>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []))
      .catch(() => {});
  }, []);

  const startEdit = (dept: DepartmentRow) => {
    setEditingId(dept.id);
    setForms((prev) => ({
      ...prev,
      [dept.id]: formFromConfig(dept.calendar_department_approvers),
    }));
    setError("");
  };

  const updateForm = (deptId: number, field: keyof FormState, value: string) => {
    setForms((prev) => ({
      ...prev,
      [deptId]: { ...(prev[deptId] ?? emptyForm()), [field]: value },
    }));
  };

  const save = async (deptId: number) => {
    const form = forms[deptId] ?? emptyForm();
    setLoadingId(deptId);
    setError("");
    try {
      const res = await fetch("/api/admin/calendar-approvers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_id: deptId,
          primary_user_id: form.primary_user_id || null,
          secondary_user_id: form.secondary_user_id || null,
          tertiary_user_id: form.tertiary_user_id || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Uložení se nezdařilo");
        return;
      }
      setEditingId(null);
      router.refresh();
    } catch {
      setError("Chyba při ukládání");
    } finally {
      setLoadingId(null);
    }
  };

  const remove = async (deptId: number) => {
    if (!confirm("Odebrat konfiguraci schvalovatelů? Použije se vedoucí oddělení.")) return;
    setLoadingId(deptId);
    setError("");
    try {
      const res = await fetch(`/api/admin/calendar-approvers?department_id=${deptId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Smazání se nezdařilo");
        return;
      }
      setEditingId(null);
      router.refresh();
    } catch {
      setError("Chyba při mazání");
    } finally {
      setLoadingId(null);
    }
  };

  const renderSelect = (
    deptId: number,
    field: keyof FormState,
    label: string,
    required?: boolean
  ) => {
    const form = forms[deptId] ?? emptyForm();
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">
          {label}
          {required ? " *" : ""}
        </span>
        <select
          value={form[field]}
          onChange={(e) => updateForm(deptId, field, e.target.value)}
          required={required}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        >
          <option value="">{required ? "— vyberte —" : "— neuvedeno —"}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {userLabel(u)}
            </option>
          ))}
        </select>
      </label>
    );
  };

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}
      <p className="text-sm text-gray-600">
        Po schválení zástupem se podle kalendáře vybere první dostupný schvalovatel (primární →
        sekundární → terciární). Pokud nejsou dostupní, použije se vedoucí oddělení.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Oddělení</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Primární</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Sekundární</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Terciární</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Vedoucí (fallback)</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Akce</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {departments.map((dept) => {
              const cfg = dept.calendar_department_approvers;
              const isEditing = editingId === dept.id;
              return (
                <tr key={dept.id} className="align-top">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {dept.name}
                    {dept.code ? (
                      <span className="ml-1 text-xs font-normal text-gray-500">({dept.code})</span>
                    ) : null}
                  </td>
                  {isEditing ? (
                    <>
                      <td className="px-4 py-3">{renderSelect(dept.id, "primary_user_id", "Primární", true)}</td>
                      <td className="px-4 py-3">{renderSelect(dept.id, "secondary_user_id", "Sekundární")}</td>
                      <td className="px-4 py-3">{renderSelect(dept.id, "tertiary_user_id", "Terciární")}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {dept.users ? userLabel(dept.users) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={loadingId === dept.id}
                            onClick={() => save(dept.id)}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Uložit
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                          >
                            Zrušit
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-gray-800">
                        {cfg ? userLabel(cfg.users_primary) : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-800">
                        {cfg?.users_secondary ? userLabel(cfg.users_secondary) : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-800">
                        {cfg?.users_tertiary ? userLabel(cfg.users_tertiary) : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {dept.users ? userLabel(dept.users) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(dept)}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                          >
                            Upravit
                          </button>
                          {cfg ? (
                            <button
                              type="button"
                              disabled={loadingId === dept.id}
                              onClick={() => remove(dept.id)}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              Odebrat
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
