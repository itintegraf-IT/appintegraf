"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTimeCz, formatDateTimeLocalForInput } from "@/lib/datetime-cz";

type UserOpt = {
  id: number;
  first_name: string;
  last_name: string;
};

type Props = {
  vyrobaUsers: UserOpt[];
};

export function NewMaketaForm({ vyrobaUsers }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      router.push(newId ? `/makety/${newId}?upload=1` : "/makety?created=1");
      router.refresh();
    } catch {
      setError("Síťová chyba");
    }
    setLoading(false);
  };

  const nowLocal = new Date();
  const defaultDue = new Date(nowLocal.getTime() + 24 * 60 * 60 * 1000);
  const dueDefault = formatDateTimeLocalForInput(defaultDue);

  return (
    <form onSubmit={onSubmit} className="max-w-4xl space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {vyrobaUsers.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          V systému není žádný aktivní uživatel s rolí „Výroba maket“. Přiřaďte tuto úroveň v
          administraci uživatelům.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-gray-700">Číslo zakázky</label>
          <input
            name="order_number"
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Volitelné"
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
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-gray-700">Popis zakázky *</label>
        <textarea
          name="body"
          required
          rows={5}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Zadání pro plotr"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-gray-700">Materiál</label>
          <input name="material" type="text" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-gray-700">Rozměr</label>
          <input name="dimensions" type="text" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-gray-700">Počet kusů</label>
          <input name="quantity" type="number" min={1} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-gray-700">Datum zadání</label>
        <p className="text-sm text-gray-600">
          {formatDateTimeCz(nowLocal)}{" "}
          <span className="text-gray-400">(automaticky při uložení)</span>
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-gray-700">Termín dokončení *</label>
        <input
          name="due_at"
          type="datetime-local"
          required
          defaultValue={dueDefault}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-gray-700">Výroba (uživatel s rolí Výroba maket) *</label>
        <select
          name="assignee_user_id"
          required
          disabled={vyrobaUsers.length === 0}
          className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">— vyberte —</option>
          {vyrobaUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.last_name} {u.first_name}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-gray-500">
        Dokumentaci (PDF, Word, Excel, obrázky, e-mail .eml/.msg) nahrajete na detailu makety po uložení —
        lze nahrát více souborů najednou.
      </p>

      <div className="flex justify-center">
        <button
          type="submit"
          disabled={loading || vyrobaUsers.length === 0}
          className="rounded-lg bg-violet-600 px-8 py-2.5 font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {loading ? "Ukládám…" : "Zapsat maketu"}
        </button>
      </div>
    </form>
  );
}
