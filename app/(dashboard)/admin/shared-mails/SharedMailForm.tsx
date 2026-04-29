"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Initial = {
  id?: number;
  email: string;
  label: string;
  sort_order: number;
  is_active: boolean;
};

export function SharedMailForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const isEdit = initial.id != null;
  const [form, setForm] = useState({
    email: initial.email,
    label: initial.label,
    sort_order: initial.sort_order,
    is_active: initial.is_active,
  });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const url = isEdit ? `/api/admin/shared-mails/${initial.id}` : "/api/admin/shared-mails";
    const method = isEdit ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error ?? "Uložení se nezdařilo");
      return;
    }
    router.push("/admin/shared-mails");
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {err && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">E-mail (schovka) *</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </div>
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Název / popisek *</label>
        <input
          type="text"
          required
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
          placeholder="např. Obchod, Recepce"
        />
      </div>
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Řazení (číslo)</label>
        <input
          type="number"
          value={form.sort_order}
          onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value, 10) || 0 })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </div>
      <div className="mb-6 flex items-center gap-2">
        <input
          type="checkbox"
          id="is_active"
          checked={form.is_active}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
        />
        <label htmlFor="is_active" className="text-sm text-gray-700">
          Aktivní (zobrazovat v přiřazeních a u uživatelů)
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Ukládám…" : "Uložit"}
        </button>
        <Link
          href="/admin/shared-mails"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>
    </form>
  );
}
