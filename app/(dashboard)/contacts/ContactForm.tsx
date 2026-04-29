"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type DeptOption = { id: number; name: string; code: string | null };

type ContactData = {
  id?: number;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  landline?: string | null;
  landline2?: string | null;
  personal_phone?: string | null;
  personal_email?: string | null;
  position?: string | null;
  department_name?: string | null;
  department_id?: number | null;
  secondary_department_ids?: number[];
  display_in_list?: boolean | null;
};

export function ContactForm({ contact }: { contact?: ContactData }) {
  const router = useRouter();
  const isEdit = !!contact?.id;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"main" | "personal">("main");
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [form, setForm] = useState({
    username: contact?.username ?? "",
    email: contact?.email ?? "",
    first_name: contact?.first_name ?? "",
    last_name: contact?.last_name ?? "",
    phone: contact?.phone ?? "",
    landline: contact?.landline ?? "",
    landline2: contact?.landline2 ?? "",
    personal_phone: contact?.personal_phone ?? "",
    personal_email: contact?.personal_email ?? "",
    position: contact?.position ?? "",
    department_name: contact?.department_name ?? "",
    department_id: contact?.department_id ?? null,
    secondary_department_ids: (contact?.secondary_department_ids ?? []).slice(0, 2),
    display_in_list: contact?.display_in_list !== false,
  });

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data: DeptOption[]) => {
        if (Array.isArray(data)) setDepartments(data);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        ...form,
        secondary_department_ids: form.secondary_department_ids.filter(
          (x): x is number => typeof x === "number" && x > 0
        ),
      };
      const url = isEdit ? `/api/contacts/${contact!.id}` : "/api/contacts";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
        setLoading(false);
        return;
      }

      router.push(isEdit ? `/contacts/${contact!.id}` : "/contacts");
      router.refresh();
    } catch {
      setError("Chyba při ukládání");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        <button
          type="button"
          onClick={() => setTab("main")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "main" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Pracovní údaje
        </button>
        <button
          type="button"
          onClick={() => setTab("personal")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "personal" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Osobní údaje
        </button>
      </div>

      {tab === "main" && (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Základní údaje</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Uživatelské jméno *</label>
            <input
              type="text"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              disabled={isEdit}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">E-mail *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Jméno *</label>
            <input
              type="text"
              required
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Příjmení *</label>
            <input
              type="text"
              required
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Pozice</label>
            <input
              type="text"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2 rounded-lg border border-gray-100 bg-gray-50/80 p-4">
            <p className="mb-3 text-sm font-medium text-gray-800">Oddělení (evidence)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Hlavní oddělení</label>
                <select
                  value={form.department_id ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      department_id: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                >
                  <option value="">— Nevybráno</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Další oddělení 1</label>
                <select
                  value={form.secondary_department_ids[0] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? parseInt(e.target.value, 10) : null;
                    setForm((prev) => {
                      const next = [...prev.secondary_department_ids];
                      if (v) next[0] = v;
                      else next.splice(0, 1);
                      return { ...prev, secondary_department_ids: next };
                    });
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                >
                  <option value="">— Nevybráno</option>
                  {departments
                    .filter(
                      (d) =>
                        d.id === form.secondary_department_ids[0] ||
                        (d.id !== form.department_id && d.id !== form.secondary_department_ids[1])
                    )
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Další oddělení 2</label>
                <select
                  value={form.secondary_department_ids[1] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? parseInt(e.target.value, 10) : null;
                    setForm((prev) => {
                      const next = [...prev.secondary_department_ids];
                      if (v) next[1] = v;
                      else next.splice(1, 1);
                      return { ...prev, secondary_department_ids: next };
                    });
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                >
                  <option value="">— Nevybráno</option>
                  {departments
                    .filter(
                      (d) =>
                        d.id === form.secondary_department_ids[1] ||
                        (d.id !== form.department_id && d.id !== form.secondary_department_ids[0])
                    )
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Text oddělení (volitelně, legacy)
              </label>
              <input
                type="text"
                value={form.department_name}
                onChange={(e) => setForm({ ...form, department_name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                placeholder="Dočasné pole – po srovnání dat můžete nechat prázdné"
              />
              <p className="mt-1 text-xs text-gray-500">
                Oddělení z evidence výše řídí telefonní seznam a vazby v systému; tento text se ukládá nezávisle.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              id="display_in_list"
              checked={form.display_in_list}
              onChange={(e) => setForm({ ...form, display_in_list: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="display_in_list" className="text-sm text-gray-700">Zobrazit v seznamu</label>
          </div>
        </div>
      </div>
      )}

      {tab === "main" && (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Kontakt</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Mobil</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tel. linka 2</label>
            <input
              type="tel"
              value={form.landline2}
              onChange={(e) => setForm({ ...form, landline2: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
        </div>
      </div>
      )}

      {tab === "personal" && (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Osobní kontakt</h2>
        <p className="mb-4 text-sm text-gray-500">
          Pouze informativní údaje, nepoužívají se pro přihlášení ani jiné funkce systému.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Osobní telefon</label>
            <input
              type="tel"
              value={form.personal_phone}
              onChange={(e) => setForm({ ...form, personal_phone: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Osobní e-mail</label>
            <input
              type="email"
              value={form.personal_email}
              onChange={(e) => setForm({ ...form, personal_email: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
        </div>
      </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-red-600 px-6 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Ukládám…" : isEdit ? "Uložit" : "Přidat"}
        </button>
        <Link
          href={isEdit ? `/contacts/${contact!.id}` : "/contacts"}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-2 font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>
    </form>
  );
}
