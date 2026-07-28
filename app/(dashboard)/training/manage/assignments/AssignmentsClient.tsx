"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Plus, Trash2, X, Power, Users, User } from "lucide-react";

type UserRow = {
  id: number;
  first_name: string;
  last_name: string;
  department_name: string | null;
};

type Assignment = {
  id: number;
  start_date: string | null;
  end_date: string | null;
  max_attempts: number | null;
  is_active: boolean | null;
  notify_on_assign: boolean;
  remind_days_before: number | null;
  created_at: string;
  tests: { id: number; name: string; is_active: boolean | null };
  user_groups: {
    id: number;
    name: string;
    _count: { user_group_members: number };
  } | null;
  target_user: UserRow | null;
  users: { first_name: string; last_name: string };
  _count: { test_attempts: number };
};

type TestOption = { id: number; name: string; is_active: boolean | null };
type GroupOption = { id: number; name: string };

type TargetType = "group" | "users";

const EMPTY_FORM = {
  test_id: "",
  group_id: "",
  start_date: "",
  end_date: "",
  max_attempts: "3",
  notify_on_assign: true,
  remind_days_before: "",
};

export function AssignmentsClient() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tests, setTests] = useState<TestOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [targetType, setTargetType] = useState<TargetType>("group");
  const [form, setForm] = useState(EMPTY_FORM);
  const [userIds, setUserIds] = useState<number[]>([]);
  const [userSearch, setUserSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [assignmentsRes, testsRes, groupsRes] = await Promise.all([
        fetch("/api/training/assignments"),
        fetch("/api/training/tests"),
        fetch("/api/training/groups"),
      ]);
      const assignmentsData = await assignmentsRes.json().catch(() => ({}));
      const testsData = await testsRes.json().catch(() => ({}));
      const groupsData = await groupsRes.json().catch(() => ({}));
      if (!assignmentsRes.ok) {
        throw new Error(assignmentsData.error ?? `Chyba při načítání (${assignmentsRes.status})`);
      }
      setAssignments(assignmentsData.assignments ?? []);
      setUsers(assignmentsData.users ?? []);
      type TestRow = { id: number; name: string; is_active: boolean | null };
      setTests(
        ((testsData.tests ?? []) as TestRow[]).filter((t) => t.is_active !== false)
      );
      type GroupRow = { id: number; name: string };
      setGroups((groupsData.groups ?? []) as GroupRow[]);
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
    setTargetType("group");
    setForm(EMPTY_FORM);
    setUserIds([]);
    setUserSearch("");
    setNotice("");
    setEditorOpen(true);
  };

  const toggleUser = (id: number) => {
    setUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return users;
    return users.filter((u) =>
      `${u.first_name} ${u.last_name} ${u.department_name ?? ""}`.toLowerCase().includes(query)
    );
  }, [users, userSearch]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload =
        targetType === "group"
          ? {
              test_id: parseInt(form.test_id, 10),
              target_type: "group",
              group_id: parseInt(form.group_id, 10),
              start_date: form.start_date || null,
              end_date: form.end_date || null,
              max_attempts: form.max_attempts ? parseInt(form.max_attempts, 10) : null,
              notify_on_assign: form.notify_on_assign,
              remind_days_before: form.end_date && form.remind_days_before
                ? parseInt(form.remind_days_before, 10)
                : null,
            }
          : {
              test_id: parseInt(form.test_id, 10),
              target_type: "users",
              user_ids: userIds,
              start_date: form.start_date || null,
              end_date: form.end_date || null,
              max_attempts: form.max_attempts ? parseInt(form.max_attempts, 10) : null,
              notify_on_assign: form.notify_on_assign,
              remind_days_before: form.end_date && form.remind_days_before
                ? parseInt(form.remind_days_before, 10)
                : null,
            };

      const res = await fetch("/api/training/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba při ukládání");

      if (targetType === "users" && data.skipped > 0) {
        setNotice(
          `Vytvořeno ${data.created} přiřazení, ${data.skipped} uživatelů už mělo aktivní přiřazení.`
        );
      }

      setEditorOpen(false);
      await load();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a: Assignment) => {
    setError("");
    const res = await fetch(`/api/training/assignments/${a.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: a.is_active === false }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Chyba při změně stavu");
      return;
    }
    await load();
  };

  const assignmentTargetLabel = (a: Assignment) => {
    if (a.target_user) {
      return `${a.target_user.first_name} ${a.target_user.last_name}`;
    }
    if (a.user_groups) {
      return a.user_groups.name;
    }
    return "—";
  };

  const remove = async (a: Assignment) => {
    const target = assignmentTargetLabel(a);
    if (
      !confirm(
        `Zrušit přiřazení testu „${a.tests.name}“ pro „${target}“? Pokud už existují pokusy, bude jen deaktivováno.`
      )
    ) {
      return;
    }
    setError("");
    const res = await fetch(`/api/training/assignments/${a.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Chyba při mazání");
      return;
    }
    await load();
  };

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString("cs-CZ") : null;

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <CalendarClock className="h-7 w-7 text-red-600" />
            Přiřazení testů
          </h1>
          <p className="mt-1 text-gray-600">
            Přidělení testů skupinám nebo konkrétním uživatelům včetně termínů a limitu pokusů
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          Nové přiřazení
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-4 py-12 text-center text-gray-500">Načítání…</div>
        ) : assignments.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            Žádná přiřazení – testy bez přiřazení jsou dostupné všem uživatelům modulu
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <p
                    className={`flex flex-wrap items-center gap-2 font-medium ${
                      a.is_active === false ? "text-gray-400 line-through" : "text-gray-900"
                    }`}
                  >
                    {a.tests.name}
                    <span className="text-gray-400">→</span>
                    {a.target_user ? (
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <User className="h-4 w-4" />
                        {a.target_user.first_name} {a.target_user.last_name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <Users className="h-4 w-4" />
                        {a.user_groups?.name}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {a.target_user
                      ? a.target_user.department_name
                        ? `Oddělení: ${a.target_user.department_name}`
                        : "Individuální přiřazení"
                      : `${a.user_groups?._count.user_group_members ?? 0} členů skupiny`}
                    {formatDate(a.start_date) && ` | od ${formatDate(a.start_date)}`}
                    {formatDate(a.end_date) && ` | do ${formatDate(a.end_date)}`}
                    {a.max_attempts !== null && ` | max. ${a.max_attempts} pokusů`}
                    {a.notify_on_assign && ` | notifikace při přiřazení`}
                    {a.remind_days_before !== null && ` | připomínka ${a.remind_days_before} dní před termínem`}
                    {` | ${a._count.test_attempts} odevzdaných pokusů`}
                    {` | zadal ${a.users.first_name} ${a.users.last_name}`}
                    {a.is_active === false && (
                      <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-gray-600">
                        neaktivní
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleActive(a)}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                    title={a.is_active === false ? "Aktivovat" : "Deaktivovat"}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(a)}
                    className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                    title="Zrušit přiřazení"
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
              <h2 className="text-lg font-bold text-gray-900">Nové přiřazení</h2>
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
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Test *</label>
                  <select
                    value={form.test_id}
                    onChange={(e) => setForm((f) => ({ ...f, test_id: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    required
                  >
                    <option value="">– vyberte test –</option>
                    {tests.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Komu přiřadit *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetType("group")}
                      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
                        targetType === "group"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Users className="h-4 w-4" />
                      Skupina uživatelů
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetType("users")}
                      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
                        targetType === "users"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <User className="h-4 w-4" />
                      Konkrétní uživatelé
                    </button>
                  </div>
                </div>

                {targetType === "group" ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Skupina *</label>
                    <select
                      value={form.group_id}
                      onChange={(e) => setForm((f) => ({ ...f, group_id: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      required
                    >
                      <option value="">– vyberte skupinu –</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    {groups.length === 0 && (
                      <p className="mt-1 text-xs text-amber-600">
                        Nejprve vytvořte skupinu v sekci Skupiny.
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Uživatelé * ({userIds.length} vybráno)
                    </label>
                    <input
                      type="text"
                      placeholder="Hledat uživatele…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Dostupné od
                    </label>
                    <input
                      type="datetime-local"
                      value={form.start_date}
                      onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Dostupné do
                    </label>
                    <input
                      type="datetime-local"
                      value={form.end_date}
                      onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Max. počet pokusů (prázdné = neomezeno)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.max_attempts}
                    onChange={(e) => setForm((f) => ({ ...f, max_attempts: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.notify_on_assign}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, notify_on_assign: e.target.checked }))
                      }
                      className="h-4 w-4"
                    />
                    Odeslat notifikaci při přiřazení testu
                  </label>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Připomínka před termínem
                    </label>
                    <select
                      value={form.remind_days_before}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, remind_days_before: e.target.value }))
                      }
                      disabled={!form.end_date}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                    >
                      <option value="">Bez připomínky</option>
                      <option value="1">1 den před termínem</option>
                      <option value="3">3 dny před termínem</option>
                      <option value="7">7 dní před termínem</option>
                      <option value="14">14 dní před termínem</option>
                    </select>
                    {!form.end_date && (
                      <p className="mt-1 text-xs text-gray-500">
                        Vyplňte termín „Dostupné do“ pro nastavení připomínky.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {targetType === "users" && (
                <div className="mx-6 mt-2 min-h-0 max-h-56 flex-1 overflow-y-auto rounded-lg border border-gray-200">
                  {filteredUsers.map((u) => (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm last:border-b-0 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={userIds.includes(u.id)}
                        onChange={() => toggleUser(u.id)}
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
              )}

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
                  disabled={
                    saving ||
                    (targetType === "users" && userIds.length === 0) ||
                    (targetType === "group" && !form.group_id)
                  }
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? "Ukládám…" : targetType === "users" ? "Přiřadit uživatelům" : "Vytvořit přiřazení"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
