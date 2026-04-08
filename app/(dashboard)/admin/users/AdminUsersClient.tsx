"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Eye,
  Pencil,
  Users,
  Laptop,
  Calendar,
  CalendarDays,
  Factory,
  Package,
  Tv,
  GraduationCap,
  ClipboardList,
  BriefcaseBusiness,
} from "lucide-react";

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  contacts: Users,
  equipment: Laptop,
  calendar: Calendar,
  planovani: CalendarDays,
  vyroba: Factory,
  iml: Package,
  kiosk: Tv,
  training: GraduationCap,
  ukoly: ClipboardList,
  personalistika: BriefcaseBusiness,
};

const MODULE_LABELS: Record<string, string> = {
  contacts: "Kontakty",
  equipment: "Majetek",
  calendar: "Kalendář",
  planovani: "Plánování výroby",
  vyroba: "Výroba",
  iml: "IML",
  kiosk: "Kiosk Monitory",
  training: "IT Školení",
  ukoly: "Úkoly",
  personalistika: "Personalistika",
};

type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  position: string | null;
  department_name: string | null;
  is_active: boolean | null;
  role_id: number | null;
  roles: { name: string } | null;
  module_access?: Record<string, string>;
};

function ukolyRoleLabel(level?: string): string {
  if (level === "write") return "Zadavatel";
  if (level === "read") return "Úkolovaný";
  if (level === "admin") return "Admin";
  return "Bez přístupu";
}

export function AdminUsersClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchUsers = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    fetch(`/api/admin/users?${params}`)
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <form onSubmit={handleSearch} className="border-b border-gray-200 p-4">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat uživatele..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Hledat
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Jméno</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">E-mail</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Oddělení</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Role</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Moduly</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Akce</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Načítání…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Žádní uživatelé
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {u.first_name} {u.last_name}
                    {u.position && (
                      <span className="ml-2 text-sm text-gray-500">({u.position})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.department_name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div>{u.roles?.name ?? "-"}</div>
                    <div className="text-xs text-gray-500">Úkoly: {ukolyRoleLabel(u.module_access?.ukoly)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="flex flex-wrap gap-1"
                      title={Object.keys(u.module_access ?? {})
                        .map((k) => MODULE_LABELS[k] ?? k)
                        .join(", ") || "—"}
                    >
                      {Object.entries(u.module_access ?? {}).map(([key]) => {
                        const Icon = MODULE_ICONS[key];
                        if (!Icon) return null;
                        return (
                          <span
                            key={key}
                            className="inline-flex rounded bg-gray-100 p-1 text-gray-600"
                            title={MODULE_LABELS[key] ?? key}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                        );
                      })}
                      {(!u.module_access || Object.keys(u.module_access).length === 0) && (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-sm ${
                        u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {u.is_active ? "Aktivní" : "Neaktivní"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/contacts/${u.id}`}
                      className="mr-2 rounded p-2 text-gray-600 hover:bg-gray-100"
                      title="Zobrazit jako kontakt"
                    >
                      <Eye className="inline h-4 w-4" />
                    </Link>
                    <Link
                      href={`/admin/users/${u.id}/edit`}
                      className="rounded p-2 text-gray-600 hover:bg-gray-100"
                      title="Upravit"
                    >
                      <Pencil className="inline h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
