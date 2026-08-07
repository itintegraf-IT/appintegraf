"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Category = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean | null;
  responsible_user_id: number | null;
  users_responsible: { id: number; first_name: string; last_name: string } | null;
  _count?: { equipment_items: number };
};

type UserOpt = { id: number; first_name: string; last_name: string };

const emptyForm = {
  name: "",
  code: "",
  description: "",
  responsible_user_id: "",
};

export default function CategoriesSettingsClient() {
  const [rows, setRows] = useState<Category[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const load = () => {
    fetch("/api/equipment/categories?all=1")
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setError("Chyba načtení"));
    fetch("/api/equipment/users")
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : d.users ?? []))
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const startEdit = (r: Category) => {
    setError("");
    setOkMsg("");
    setEditing(r);
    setForm({
      name: r.name,
      code: r.code,
      description: r.description ?? "",
      responsible_user_id: r.responsible_user_id ? String(r.responsible_user_id) : "",
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const save = async () => {
    setError("");
    setOkMsg("");
    const name = form.name.trim();
    const code = form.code.trim();
    if (!name || !code) {
      setError("Název a kód jsou povinné.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/equipment/categories/${editing.id}` : "/api/equipment/categories",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            code,
            description: form.description.trim() || null,
            responsible_user_id: form.responsible_user_id || null,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Chyba uložení");
        return;
      }
      setOkMsg(editing ? "Skupina upravena." : "Skupina vytvořena.");
      resetForm();
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Category) => {
    const itemCount = r._count?.equipment_items ?? 0;
    if (itemCount > 0) {
      if (
        !window.confirm(
          `Skupina „${r.name}“ obsahuje ${itemCount} položek a nelze ji smazat. Chcete ji deaktivovat?`
        )
      ) {
        return;
      }
      setError("");
      setOkMsg("");
      const res = await fetch(`/api/equipment/categories/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Chyba deaktivace");
        return;
      }
      setOkMsg("Skupina deaktivována.");
      if (editing?.id === r.id) resetForm();
      load();
      return;
    }

    if (!window.confirm(`Opravdu smazat skupinu „${r.name}“ (${r.code})?`)) return;

    setError("");
    setOkMsg("");
    const res = await fetch(`/api/equipment/categories/${r.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Chyba mazání");
      return;
    }
    setOkMsg("Skupina smazána.");
    if (editing?.id === r.id) resetForm();
    load();
  };

  const reactivate = async (r: Category) => {
    setError("");
    setOkMsg("");
    const res = await fetch(`/api/equipment/categories/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Chyba obnovení");
      return;
    }
    setOkMsg("Skupina obnovena.");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Skupiny majetku</h1>
          <p className="text-gray-600">Přidání, úprava a mazání skupin a zodpovědných uživatelů</p>
        </div>
        <Link href="/equipment/settings" className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
          Zpět
        </Link>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {okMsg ? <p className="text-sm text-green-700">{okMsg}</p> : null}

      <div ref={formRef} className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">{editing ? "Upravit skupinu" : "Nová skupina"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="Název"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="rounded-lg border px-3 py-2 font-mono uppercase"
            placeholder="Kód"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <input
            className="rounded-lg border px-3 py-2 sm:col-span-2"
            placeholder="Popis"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <select
            className="rounded-lg border px-3 py-2 sm:col-span-2"
            value={form.responsible_user_id}
            onChange={(e) => setForm({ ...form, responsible_user_id: e.target.value })}
          >
            <option value="">— Zodpovědný uživatel —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.last_name} {u.first_name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Ukládám…" : editing ? "Uložit změny" : "Přidat skupinu"}
          </button>
          {editing ? (
            <button type="button" onClick={resetForm} className="rounded-lg border px-4 py-2">
              Zrušit
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Název</th>
              <th className="px-3 py-2">Kód</th>
              <th className="px-3 py-2">Zodpovědný</th>
              <th className="px-3 py-2">Položek</th>
              <th className="px-3 py-2">Stav</th>
              <th className="px-3 py-2">Akce</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  Zatím žádné skupiny. Přidejte první výše.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const active = r.is_active !== false;
                return (
                  <tr
                    key={r.id}
                    className={`border-t ${active ? "" : "bg-gray-50 text-gray-500"}`}
                  >
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 font-mono">{r.code}</td>
                    <td className="px-3 py-2">
                      {r.users_responsible
                        ? `${r.users_responsible.last_name} ${r.users_responsible.first_name}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">{r._count?.equipment_items ?? 0}</td>
                    <td className="px-3 py-2">
                      {active ? (
                        <span className="text-green-700">Aktivní</span>
                      ) : (
                        <span>Neaktivní</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="text-red-700 hover:underline"
                          onClick={() => startEdit(r)}
                        >
                          Upravit
                        </button>
                        {active ? (
                          <button
                            type="button"
                            className="text-gray-700 hover:underline"
                            onClick={() => void remove(r)}
                          >
                            {(r._count?.equipment_items ?? 0) > 0 ? "Deaktivovat" : "Smazat"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="text-green-700 hover:underline"
                            onClick={() => void reactivate(r)}
                          >
                            Obnovit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
