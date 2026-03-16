"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Laptop, Calendar, Tv, GraduationCap, CalendarDays } from "lucide-react";

const AVAILABLE_MODULES = [
  { key: "contacts", label: "Kontakty", icon: Users },
  { key: "equipment", label: "Majetek", icon: Laptop },
  { key: "calendar", label: "Kalendář", icon: Calendar },
  { key: "planovani", label: "Plánování výroby", icon: CalendarDays },
  { key: "kiosk", label: "Kiosk Monitory", icon: Tv },
  { key: "training", label: "IT Školení", icon: GraduationCap },
] as const;

/** Mapování UI úrovní na hodnoty v DB (auth-utils: read/write/admin) */
const PERMISSION_LEVELS = [
  { value: "read", label: "Viewer" },
  { value: "write", label: "Editor" },
  { value: "admin", label: "Admin" },
] as const;

type Role = { id: number; name: string };
type Department = { id: number; name: string; code?: string | null };
type ModuleAccessMap = Record<string, string>;
type User = {
  id?: number;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  landline?: string | null;
  landline2?: string | null;
  position?: string | null;
  department_id?: number | null;
  department_name?: string | null;
  secondary_department_ids?: number[];
  is_active?: boolean | null;
  display_in_list?: boolean | null;
  role_id?: number | null;
  module_access?: ModuleAccessMap;
};

export function AdminUserForm({ user }: { user?: User }) {
  const router = useRouter();
  const isEdit = !!user?.id;
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: user?.username ?? "",
    email: user?.email ?? "",
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    phone: user?.phone ?? "",
    landline: user?.landline ?? "",
    landline2: user?.landline2 ?? "",
    position: user?.position ?? "",
    department_id: user?.department_id ?? null,
    secondary_department_ids: (user?.secondary_department_ids ?? []) as number[],
    role_id: user?.role_id ?? 1,
    module_access: (user?.module_access ?? {}) as ModuleAccessMap,
    is_active: user?.is_active !== false,
    display_in_list: user?.display_in_list !== false,
    password_custom: "",
  });

  useEffect(() => {
    fetch("/api/roles")
      .then((r) => r.json())
      .then(setRoles)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data) => setDepartments(Array.isArray(data) ? data : []))
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (user) {
      setForm({
        username: user.username ?? "",
        email: user.email ?? "",
        first_name: user.first_name ?? "",
        last_name: user.last_name ?? "",
        phone: user.phone ?? "",
        landline: user.landline ?? "",
        landline2: user.landline2 ?? "",
        position: user.position ?? "",
        department_id: user.department_id ?? null,
        secondary_department_ids: user.secondary_department_ids ?? [],
        role_id: user.role_id ?? 1,
        module_access: user.module_access ?? {},
        is_active: user.is_active !== false,
        display_in_list: user.display_in_list !== false,
        password_custom: "",
      });
    }
  }, [user]);

  const setModuleVisible = (moduleKey: string, visible: boolean) => {
    setForm((prev) => {
      const next = { ...prev.module_access };
      if (visible) {
        next[moduleKey] = "read"; // výchozí Viewer
      } else {
        delete next[moduleKey];
      }
      return { ...prev, module_access: next };
    });
  };

  const setModulePermission = (moduleKey: string, level: string) => {
    setForm((prev) => ({
      ...prev,
      module_access: {
        ...prev.module_access,
        [moduleKey]: level,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = isEdit ? `/api/admin/users/${user!.id}` : "/api/admin/users";
      const method = isEdit ? "PUT" : "POST";
      const body: Record<string, unknown> = {
        ...form,
        module_access: form.module_access,
        password_custom: form.password_custom || (isEdit ? undefined : "heslo123"),
      };
      if (isEdit) {
        delete body.username;
        body.password_new = form.password_custom || undefined;
        delete body.password_custom;
      }
      if (isEdit && !form.password_custom) delete body.password_new;

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

      router.push(isEdit ? "/admin/users" : `/admin/users/${data.id}/edit`);
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
          <label className="mb-1 block text-sm font-medium text-gray-700">Hlavní oddělení</label>
          <select
            value={form.department_id ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                department_id: e.target.value ? parseInt(e.target.value, 10) : null,
              })
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
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
          <label className="mb-1 block text-sm font-medium text-gray-700">Sekundární oddělení 1</label>
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
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
          <label className="mb-1 block text-sm font-medium text-gray-700">Sekundární oddělení 2</label>
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
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
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
          <select
            value={form.role_id}
            onChange={(e) => setForm({ ...form, role_id: parseInt(e.target.value, 10) })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
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
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {isEdit ? "Nové heslo (nechte prázdné)" : "Heslo"}
          </label>
          <input
            type="password"
            value={form.password_custom}
            onChange={(e) => setForm({ ...form, password_custom: e.target.value })}
            placeholder={isEdit ? "" : "heslo123 (výchozí)"}
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
            Zobrazit v kontaktech a telefonním seznamu
          </label>
        </div>
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
      </div>

      {/* Moduly – viditelnost a oprávnění */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-6">
        <h3 className="mb-2 text-lg font-semibold text-gray-900">Přístup k modulům</h3>
        <p className="mb-4 text-sm text-gray-600">
          Zaškrtnutím povolíte uživateli přístup k modulu (zobrazí se v menu). U každého modulu nastavte úroveň: Viewer = pouze prohlížení, Editor = může přidávat a měnit, Admin = plný přístup v modulu.
        </p>
        <div className="space-y-3">
          {AVAILABLE_MODULES.map((mod) => {
            const Icon = mod.icon;
            const level = form.module_access[mod.key] ?? "";
            const isVisible = !!level;
            return (
              <div
                key={mod.key}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white p-4"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={(e) => setModuleVisible(mod.key, e.target.checked)}
                    className="rounded"
                  />
                  <Icon className="h-5 w-5 shrink-0 text-gray-600" />
                  <span className="text-sm font-medium">{mod.label}</span>
                </label>
                <select
                  value={isVisible ? level : ""}
                  onChange={(e) => setModulePermission(mod.key, e.target.value)}
                  disabled={!isVisible}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">—</option>
                  {PERMISSION_LEVELS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
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
          href={isEdit ? "/admin/users" : "/admin/users/add"}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>
    </form>
  );
}
