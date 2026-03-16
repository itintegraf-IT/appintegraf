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

const ACCESS_LEVELS = [
  { value: "", label: "Bez přístupu" },
  { value: "read", label: "Čtení" },
  { value: "write", label: "Úpravy" },
  { value: "admin", label: "Admin" },
] as const;

type Role = { id: number; name: string };
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
  department_name?: string | null;
  is_active?: boolean | null;
  display_in_list?: boolean | null;
  role_id?: number | null;
  module_access?: ModuleAccessMap;
};

export function AdminUserForm({ user }: { user?: User }) {
  const router = useRouter();
  const isEdit = !!user?.id;
  const [roles, setRoles] = useState<Role[]>([]);
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
    department_name: user?.department_name ?? "",
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
        department_name: user.department_name ?? "",
        role_id: user.role_id ?? 1,
        module_access: user.module_access ?? {},
        is_active: user.is_active !== false,
        display_in_list: user.display_in_list !== false,
        password_custom: "",
      });
    }
  }, [user]);

  const setModuleAccess = (moduleKey: string, level: string) => {
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
          <label className="mb-1 block text-sm font-medium text-gray-700">Oddělení</label>
          <input
            type="text"
            value={form.department_name}
            onChange={(e) => setForm({ ...form, department_name: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
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

      {/* Moduly a úroveň přístupu – každý modul má vlastní úroveň */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-6">
        <h3 className="mb-2 text-lg font-semibold text-gray-900">Přístup k modulům</h3>
        <p className="mb-4 text-sm text-gray-600">
          U každého modulu nastavte úroveň přístupu. Čtení = pouze prohlížení, Úpravy = může přidávat a měnit, Admin = plný přístup v modulu.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AVAILABLE_MODULES.map((mod) => {
            const Icon = mod.icon;
            const level = form.module_access[mod.key] ?? "";
            return (
              <div
                key={mod.key}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 shrink-0 text-gray-600" />
                  <span className="text-sm font-medium">{mod.label}</span>
                </div>
                <select
                  value={level}
                  onChange={(e) => setModuleAccess(mod.key, e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {ACCESS_LEVELS.map((opt) => (
                    <option key={opt.value || "none"} value={opt.value}>
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
