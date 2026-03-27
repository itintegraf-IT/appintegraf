"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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
  display_in_list?: boolean | null;
};

export function ContactForm({ contact }: { contact?: ContactData }) {
  const router = useRouter();
  const isEdit = !!contact?.id;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"main" | "personal">("main");
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
    display_in_list: contact?.display_in_list !== false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body: Record<string, unknown> = { ...form };
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
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Pozice</label>
            <input
              type="text"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Oddělení</label>
            <input
              type="text"
              value={form.department_name}
              onChange={(e) => setForm({ ...form, department_name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="flex items-center gap-2">
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
