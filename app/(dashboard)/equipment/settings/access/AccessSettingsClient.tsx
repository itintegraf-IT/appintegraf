"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Cat = { id: number; name: string; code: string };
type AccessRow = {
  user: { id: number; first_name: string; last_name: string; email: string };
  categories: Cat[];
};
type UserOpt = { id: number; first_name: string; last_name: string };

export default function AccessSettingsClient() {
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [userId, setUserId] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [msg, setMsg] = useState("");

  const load = () => {
    fetch("/api/equipment/access")
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []));
    fetch("/api/equipment/categories")
      .then((r) => r.json())
      .then((d) => setCats(Array.isArray(d) ? d : []));
    fetch("/api/equipment/users")
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : d.users ?? []));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!userId) {
      setSelected([]);
      return;
    }
    const existing = rows.find((r) => r.user.id === parseInt(userId, 10));
    setSelected(existing ? existing.categories.map((c) => c.id) : []);
  }, [userId, rows]);

  const save = async () => {
    setMsg("");
    const res = await fetch("/api/equipment/access", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: parseInt(userId, 10), category_ids: selected }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error ?? "Chyba");
      return;
    }
    setMsg("Uloženo.");
    load();
  };

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Přístupy nahlížení</h1>
          <p className="text-gray-600">Přiřazení skupin majetku uživatelům (read)</p>
        </div>
        <Link href="/equipment/settings" className="rounded-lg border px-3 py-2 text-sm">
          Zpět
        </Link>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
        <select
          className="w-full rounded-lg border px-3 py-2"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        >
          <option value="">— Vyberte uživatele —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.last_name} {u.first_name}
            </option>
          ))}
        </select>
        <div className="grid gap-2 sm:grid-cols-2">
          {cats.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggle(c.id)}
              />
              {c.name} ({c.code})
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={!userId}
          onClick={() => void save()}
          className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50"
        >
          Uložit přístupy
        </button>
        {msg ? <p className="text-sm text-green-700">{msg}</p> : null}
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Aktuální nahlížení</h2>
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.user.id}>
              <strong>
                {r.user.last_name} {r.user.first_name}
              </strong>
              : {r.categories.map((c) => c.name).join(", ") || "—"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
