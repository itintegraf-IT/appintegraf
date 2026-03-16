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
  CalendarDays,
} from "lucide-react";

type SidebarProps = {
  user: { name?: string | null };
  isAdmin: boolean;
  moduleAccess: Record<string, boolean>;
  mobileOpen?: boolean;
  onClose?: () => void;
};

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard", module: null },
  { href: "/contacts", icon: Users, label: "Kontakty", module: "contacts" },
  { href: "/equipment", icon: Laptop, label: "Majetek", module: "equipment" },
  { href: "/calendar", icon: Calendar, label: "Kalendář", module: "calendar" },
  { href: "/planovani", icon: CalendarDays, label: "Plánování výroby", module: "planovani" },
  { href: "/kiosk", icon: Tv, label: "Kiosk Monitory", module: "kiosk" },
  { href: "/phone-list", icon: Phone, label: "Telefonní seznam", module: null },
  { href: "/training", icon: GraduationCap, label: "IT Školení", module: "training" },
];

export function Sidebar({ user, isAdmin, moduleAccess, mobileOpen = false, onClose }: SidebarProps) {
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
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed left-0 top-14 z-50 h-[calc(100vh-3.5rem)] w-56 flex-col border-r transition-transform duration-200 lg:flex ${
          mobileOpen ? "flex translate-x-0" : "hidden -translate-x-full lg:translate-x-0"
        }`}
        style={{
          background: "var(--sidebar)",
          borderColor: "var(--sidebar-border)",
        }}
      >
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
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
                  style={{
                    background: isActive ? "var(--sidebar-accent)" : "transparent",
                    color: isActive ? "var(--sidebar-accent-foreground)" : "var(--sidebar-foreground)",
                  }}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}

          {isAdmin && (
            <>
              <li className="my-2 border-t" style={{ borderColor: "var(--sidebar-border)" }} />
              <li>
                <Link
                  href="/admin"
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
                  style={{
                    background: pathname.startsWith("/admin") ? "var(--sidebar-accent)" : "transparent",
                    color: pathname.startsWith("/admin") ? "var(--sidebar-accent-foreground)" : "var(--sidebar-foreground)",
                  }}
                >
                  <Wrench className="h-5 w-5" />
                  Administrace
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/reports"
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
                  style={{
                    background: pathname === "/admin/reports" ? "var(--sidebar-accent)" : "transparent",
                    color: pathname === "/admin/reports" ? "var(--sidebar-accent-foreground)" : "var(--sidebar-foreground)",
                  }}
                >
                  <BarChart3 className="h-5 w-5" />
                  Reporty
                </Link>
              </li>
            </>
          )}

          <li className="my-2 border-t" style={{ borderColor: "var(--sidebar-border)" }} />
          <li>
            <Link
              href="/profile"
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-[var(--sidebar-accent)]"
              style={{ color: "var(--sidebar-foreground)" }}
            >
              <User className="h-5 w-5" />
              Profil
            </Link>
          </li>
          <li>
            <Link
              href="/settings"
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-[var(--sidebar-accent)]"
              style={{ color: "var(--sidebar-foreground)" }}
            >
              <Settings className="h-5 w-5" />
              Nastavení
            </Link>
          </li>
        </ul>
      </nav>

      <div
        className="flex items-center gap-3 border-t p-3"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium"
          style={{ background: "var(--sidebar-primary)", color: "var(--sidebar-primary-foreground)" }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" style={{ color: "var(--sidebar-foreground)" }}>
            {user.name}
          </p>
          <p className="truncate text-xs" style={{ color: "var(--muted-foreground)" }}>
            Odhlásit
          </p>
        </div>
        <Link
          href="/api/auth/signout"
          onClick={onClose}
          className="rounded-lg p-2 hover:bg-[var(--sidebar-accent)]"
          style={{ color: "var(--sidebar-foreground)" }}
          title="Odhlásit se"
        >
          <LogOut className="h-5 w-5" />
        </Link>
      </div>
    </aside>
    </>
  );
}
