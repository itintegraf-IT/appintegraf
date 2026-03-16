"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type User = { id: number; first_name: string; last_name: string };
type Department = {
  id?: number;
  name?: string;
  code?: string | null;
  description?: string | null;
  manager_id?: number | null;
  phone?: string | null;
  email?: string | null;
  landline?: string | null;
  landline2?: string | null;
  notes?: string | null;
  is_active?: boolean | null;
  display_in_list?: boolean | null;
};

export function DepartmentForm({ department }: { department?: Department }) {
  const router = useRouter();
  const isEdit = !!department?.id;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: department?.name ?? "",
    code: department?.code ?? "",
    description: department?.description ?? "",
    manager_id: department?.manager_id ? String(department.manager_id) : "",
    phone: department?.phone ?? "",
    email: department?.email ?? "",
    landline: department?.landline ?? "",
    landline2: department?.landline2 ?? "",
    notes: department?.notes ?? "",
    is_active: department?.is_active !== false,
    display_in_list: department?.display_in_list !== false,
  });

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (department) {
      setForm({
        name: department.name ?? "",
        code: department.code ?? "",
        description: department.description ?? "",
        manager_id: department.manager_id ? String(department.manager_id) : "",
        phone: department.phone ?? "",
        email: department.email ?? "",
        landline: department.landline ?? "",
        landline2: department.landline2 ?? "",
        notes: department.notes ?? "",
        is_active: department.is_active !== false,
        display_in_list: department.display_in_list !== false,
      });
    }
  }, [department]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = isEdit ? `/api/admin/departments/${department!.id}` : "/api/admin/departments";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, manager_id: form.manager_id || null }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
        setLoading(false);
        return;
      }

      router.push("/admin/departments");
      router.refresh();
    } catch {
      setError("Chyba při ukládání");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Název *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Kód</label>
          <input
            type="text"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Vedoucí</label>
          <select
            value={form.manager_id}
            onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.first_name} {u.last_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Telefon</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">E-mail</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Pevná linka</label>
          <input
            type="tel"
            value={form.landline}
            onChange={(e) => setForm({ ...form, landline: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            id="is_active"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="rounded"
          />
          <label htmlFor="is_active" className="text-sm text-gray-700">Aktivní</label>
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            id="display_in_list"
            checked={form.display_in_list}
            onChange={(e) => setForm({ ...form, display_in_list: e.target.checked })}
            className="rounded"
          />
          <label htmlFor="display_in_list" className="text-sm text-gray-700">
            Zobrazit v telefonním seznamu
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Poznámky</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-red-600 px-6 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Ukládám…" : isEdit ? "Uložit" : "Přidat"}
        </button>
        <Link
          href="/admin/departments"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>
    </form>
  );
}
