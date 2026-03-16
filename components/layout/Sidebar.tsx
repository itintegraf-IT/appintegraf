"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Laptop,
  Calendar,
  Tv,
  Phone,
  GraduationCap,
  Wrench,
  BarChart3,
  User,
  Settings,
  LogOut,
} from "lucide-react";

type SidebarProps = {
  user: { name?: string | null };
  isAdmin: boolean;
  moduleAccess: Record<string, boolean>;
};

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard", module: null },
  { href: "/contacts", icon: Users, label: "Kontakty", module: "contacts" },
  { href: "/equipment", icon: Laptop, label: "Majetek", module: "equipment" },
  { href: "/calendar", icon: Calendar, label: "Kalendář", module: "calendar" },
  { href: "/kiosk", icon: Tv, label: "Kiosk Monitory", module: "kiosk" },
  { href: "/phone-list", icon: Phone, label: "Telefonní seznam", module: null },
  { href: "/training", icon: GraduationCap, label: "IT Školení", module: "training" },
];

export function Sidebar({ user, isAdmin, moduleAccess }: SidebarProps) {
  const pathname = usePathname();

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <aside className="fixed left-0 top-14 z-30 hidden h-[calc(100vh-3.5rem)] w-56 flex-col border-r border-gray-200 bg-white lg:flex">
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => {
            if (item.module && !moduleAccess[item.module]) return null;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-red-50 font-medium text-red-600"
                      : "text-gray-600 hover:bg-gray-50 hover:text-red-600"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}

          {isAdmin && (
            <>
              <li className="my-2 border-t border-gray-200" />
              <li>
                <Link
                  href="/admin"
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                    pathname.startsWith("/admin")
                      ? "bg-red-50 font-medium text-red-600"
                      : "text-gray-600 hover:bg-gray-50 hover:text-red-600"
                  }`}
                >
                  <Wrench className="h-5 w-5" />
                  Administrace
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/reports"
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                    pathname === "/admin/reports"
                      ? "bg-red-50 font-medium text-red-600"
                      : "text-gray-600 hover:bg-gray-50 hover:text-red-600"
                  }`}
                >
                  <BarChart3 className="h-5 w-5" />
                  Reporty
                </Link>
              </li>
            </>
          )}

          <li className="my-2 border-t border-gray-200" />
          <li>
            <Link
              href="/profile"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-red-600"
            >
              <User className="h-5 w-5" />
              Profil
            </Link>
          </li>
          <li>
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-red-600"
            >
              <Settings className="h-5 w-5" />
              Nastavení
            </Link>
          </li>
        </ul>
      </nav>

      <div className="flex items-center gap-3 border-t border-gray-200 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-medium text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
          <p className="truncate text-xs text-gray-500">Odhlásit</p>
        </div>
        <Link
          href="/api/auth/signout"
          className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
          title="Odhlásit se"
        >
          <LogOut className="h-5 w-5" />
        </Link>
      </div>
    </aside>
  );
}
