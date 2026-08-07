"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, Plus, Pencil, Trash2, X } from "lucide-react";

type UserRow = {
  id: number;
  first_name: string;
  last_name: string;
  department_name: string | null;
};

type Group = {
  id: number;
  name: string;
  description: string | null;
  user_group_members: {
    users_user_group_members_user_idTousers: {
      id: number;
      first_name: string;
      last_name: string;
      is_active: boolean | null;
    };
  }[];
  _count: { test_assignments: number };
};

export function GroupsClient() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/training/groups");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chyba při načítání");
      setGroups(data.groups ?? []);
      setUsers(data.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při načítání");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: "", description: "" });
    setMemberIds([]);
    setMemberSearch("");
    setEditorOpen(true);
  };

  const openEdit = (g: Group) => {
    setEditingId(g.id);
    setForm({ name: g.name, description: g.description ?? "" });
    setMemberIds(g.user_group_members.map((m) => m.users_user_group_members_user_idTousers.id));
    setMemberSearch("");
    setEditorOpen(true);
  };

  const toggleMember = (id: number) => {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, member_ids: memberIds };
      const res = await fetch(
        editingId ? `/api/training/groups/${editingId}` : "/api/training/groups",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba při ukládání");
      setEditorOpen(false);
      await load();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (g: Group) => {
    if (!confirm(`Smazat skupinu „${g.name}“?`)) return;
    setError("");
    const res = await fetch(`/api/training/groups/${g.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Chyba při mazání");
      return;
    }
    await load();
  };

  const filteredUsers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return users;
    return users.filter((u) =>
      `${u.first_name} ${u.last_name} ${u.department_name ?? ""}`.toLowerCase().includes(query)
    );
  }, [users, memberSearch]);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Users className="h-7 w-7 text-red-600" />
            Skupiny uživatelů
          </h1>
          <p className="mt-1 text-gray-600">Skupiny slouží k přiřazování testů</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          Nová skupina
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-4 py-12 text-center text-gray-500">Načítání…</div>
        ) : groups.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">Žádné skupiny</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {groups.map((g) => (
              <div key={g.id} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{g.name}</p>
                  {g.description && <p className="text-sm text-gray-500">{g.description}</p>}
                  <p className="mt-1 text-xs text-gray-400">
                    {g.user_group_members.length} členů | {g._count.test_assignments} přiřazených testů
                  </p>
                  {g.user_group_members.length > 0 && (
                    <p className="mt-1 truncate text-xs text-gray-500">
                      {g.user_group_members
                        .slice(0, 8)
                        .map(
                          (m) =>
                            `${m.users_user_group_members_user_idTousers.first_name} ${m.users_user_group_members_user_idTousers.last_name}`
                        )
                        .join(", ")}
                      {g.user_group_members.length > 8 && ` +${g.user_group_members.length - 8} dalších`}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(g)}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                    title="Upravit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(g)}
                    className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                    title="Smazat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-6 pb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? "Upravit skupinu" : "Nová skupina"}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-4 px-6 pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Název *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Popis</label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Členové ({memberIds.length})
                  </label>
                  <input
                    type="text"
                    placeholder="Hledat uživatele…"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="mx-6 mt-2 min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200">
                {filteredUsers.map((u) => (
                  <label
                    key={u.id}
                    className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm last:border-b-0 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={memberIds.includes(u.id)}
                      onChange={() => toggleMember(u.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-gray-900">
                      {u.first_name} {u.last_name}
                    </span>
                    {u.department_name && (
                      <span className="text-xs text-gray-400">{u.department_name}</span>
                    )}
                  </label>
                ))}
                {filteredUsers.length === 0 && (
                  <p className="px-3 py-4 text-center text-sm text-gray-500">Nikdo nenalezen</p>
                )}
              </div>

              <div className="flex justify-end gap-2 p-6 pt-4">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? "Ukládám…" : "Uložit skupinu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
