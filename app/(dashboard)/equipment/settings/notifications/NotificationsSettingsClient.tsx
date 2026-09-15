"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Plus, Trash2 } from "lucide-react";

type UserOpt = { id: number; first_name: string; last_name: string; email?: string };

function personLabel(u: UserOpt) {
  return `${u.last_name} ${u.first_name}`.trim();
}

export default function NotificationsSettingsClient() {
  const [allUsers, setAllUsers] = useState<UserOpt[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [addUserId, setAddUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const [usersRes, settingsRes] = await Promise.all([
        fetch("/api/equipment/users"),
        fetch("/api/equipment/settings/movement-notify"),
      ]);
      const usersData = await usersRes.json().catch(() => []);
      const settingsData = await settingsRes.json().catch(() => ({}));
      if (!usersRes.ok) {
        setErr(usersData.error ?? "Nepodařilo se načíst uživatele");
        return;
      }
      if (!settingsRes.ok) {
        setErr(settingsData.error ?? "Nepodařilo se načíst nastavení");
        return;
      }
      setAllUsers(Array.isArray(usersData) ? usersData : usersData.users ?? []);
      setSelectedIds(
        Array.isArray(settingsData.user_ids)
          ? settingsData.user_ids.map((id: unknown) => Number(id)).filter((n: number) => n > 0)
          : []
      );
    } catch {
      setErr("Načtení selhalo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedUsers = useMemo(() => {
    const byId = new Map(allUsers.map((u) => [u.id, u]));
    return selectedIds
      .map((id) => byId.get(id) ?? { id, first_name: "?", last_name: `ID ${id}` })
      .sort((a, b) => personLabel(a).localeCompare(personLabel(b), "cs"));
  }, [allUsers, selectedIds]);

  const availableToAdd = useMemo(
    () => allUsers.filter((u) => !selectedIds.includes(u.id)),
    [allUsers, selectedIds]
  );

  const addUser = () => {
    const id = parseInt(addUserId, 10);
    if (!Number.isFinite(id) || id <= 0 || selectedIds.includes(id)) return;
    setSelectedIds((prev) => [...prev, id]);
    setAddUserId("");
    setMsg("");
  };

  const removeUser = (id: number) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setMsg("");
  };

  const save = async () => {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/equipment/settings/movement-notify", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: selectedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Uložení selhalo");
        return;
      }
      setSelectedIds(Array.isArray(data.user_ids) ? data.user_ids : selectedIds);
      setMsg("Uloženo.");
    } catch {
      setErr("Uložení selhalo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Bell className="h-7 w-7 text-red-600" />
            Notifikace pohybů
          </h1>
          <p className="mt-1 text-gray-600">
            Účtárna a držitel dostávají notifikace vždy; zde jen další osoby.
          </p>
        </div>
        <Link
          href="/equipment/settings"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Zpět
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-sm text-gray-600">
          Při přidělení, vrácení nebo přesunu majetku dostanou vybraní uživatelé in-app notifikaci a
          (pokud mají zapnuté e-maily pro majetek) i e-mail s odkazem na protokol.
        </p>

        {loading ? (
          <p className="text-sm text-gray-500">Načítám…</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[220px] flex-1 text-sm text-gray-700">
                <span className="mb-1 block font-medium">Přidat uživatele</span>
                <select
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">— Vyberte —</option>
                  {availableToAdd.map((u) => (
                    <option key={u.id} value={u.id}>
                      {personLabel(u)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={addUser}
                disabled={!addUserId}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Přidat
              </button>
            </div>

            {selectedUsers.length === 0 ? (
              <p className="text-sm text-gray-500">Zatím žádní dodateční příjemci.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {selectedUsers.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-gray-900">{personLabel(u)}</span>
                    <button
                      type="button"
                      onClick={() => removeUser(u.id)}
                      className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                      title="Odebrat"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Odebrat
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {err ? <p className="text-sm text-red-600">{err}</p> : null}
            {msg ? <p className="text-sm text-green-700">{msg}</p> : null}

            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? "Ukládám…" : "Uložit"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
