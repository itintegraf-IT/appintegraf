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
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "./SidebarContext";

type SidebarProps = {
  user: { name?: string | null };
  isAdmin: boolean;
  moduleAccess: Record<string, boolean>;
  mobileOpen?: boolean;
  onClose?: () => void;
};

function NavLink({
  href,
  icon: Icon,
  label,
  isActive,
  onClick,
  collapsed,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  onClick?: () => void;
  collapsed: boolean;
}) {
  const linkContent = (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2 text-sm transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] ${
        collapsed ? "justify-center px-2" : ""
      }`}
      style={{
        background: isActive ? "var(--sidebar-accent)" : "transparent",
        color: isActive ? "var(--sidebar-accent-foreground)" : "var(--sidebar-foreground)",
        borderLeftColor: isActive ? "var(--sidebar-primary)" : "transparent",
      }}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

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
  const { collapsed, toggleCollapsed } = useSidebar();
  const isCollapsed = collapsed && !mobileOpen;

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
        className={`fixed left-0 top-14 z-50 h-[calc(100vh-3.5rem)] flex-col border-r transition-all duration-200 lg:flex ${
          mobileOpen ? "flex translate-x-0" : "hidden -translate-x-full lg:translate-x-0"
        } ${isCollapsed ? "w-16" : "w-56"}`}
        style={{
          background: "var(--sidebar)",
          borderColor: "var(--sidebar-border)",
          boxShadow: "var(--sidebar-shadow)",
        }}
      >
      <div className="flex flex-col h-full">
      <div
        className={`flex items-center border-b shrink-0 ${isCollapsed ? "justify-center px-2 py-2" : "justify-between px-3 py-2"}`}
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        {!isCollapsed && (
          <span className="text-sm font-medium" style={{ color: "var(--sidebar-foreground)" }}>
            Menu
          </span>
        )}
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="rounded-lg p-2 hover:bg-[var(--sidebar-accent)] transition-colors"
                style={{ color: "var(--sidebar-foreground)" }}
                aria-label={isCollapsed ? "Rozbalit menu" : "Sbalit menu"}
              >
                {isCollapsed ? (
                  <PanelLeft className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {isCollapsed ? "Rozbalit menu" : "Sbalit na ikony"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <TooltipProvider>
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => {
            if (item.module && !moduleAccess[item.module]) return null;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  isActive={!!isActive}
                  onClick={onClose}
                  collapsed={isCollapsed}
                />
              </li>
            );
          })}

          {isAdmin && (
            <>
              <li className="my-2 border-t" style={{ borderColor: "var(--sidebar-border)" }} />
              <li>
                <NavLink
                  href="/admin"
                  icon={Wrench}
                  label="Administrace"
                  isActive={pathname.startsWith("/admin")}
                  onClick={onClose}
                  collapsed={isCollapsed}
                />
              </li>
              <li>
                <NavLink
                  href="/admin/reports"
                  icon={BarChart3}
                  label="Reporty"
                  isActive={pathname === "/admin/reports"}
                  onClick={onClose}
                  collapsed={isCollapsed}
                />
              </li>
            </>
          )}

          <li className="my-2 border-t" style={{ borderColor: "var(--sidebar-border)" }} />
          <li>
            <NavLink
              href="/profile"
              icon={User}
              label="Profil"
              isActive={false}
              onClick={onClose}
              collapsed={isCollapsed}
            />
          </li>
          <li>
            <NavLink
              href="/settings"
              icon={Settings}
              label="Nastavení"
              isActive={false}
              onClick={onClose}
              collapsed={isCollapsed}
            />
          </li>
        </ul>
        </TooltipProvider>
      </nav>

      <div
        className={`flex items-center border-t p-3 ${isCollapsed ? "flex-col gap-2 justify-center" : "gap-3"}`}
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium cursor-default"
                style={{ background: "var(--sidebar-primary)", color: "var(--sidebar-primary-foreground)" }}
              >
                {initials}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {user.name}
            </TooltipContent>
          </Tooltip>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" style={{ color: "var(--sidebar-foreground)" }}>
                {user.name}
              </p>
              <p className="truncate text-xs" style={{ color: "var(--muted-foreground)" }}>
                Odhlásit
              </p>
            </div>
          )}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link
                href="/api/auth/signout"
                onClick={onClose}
                className={`rounded-lg p-2 hover:bg-[var(--sidebar-accent)] ${isCollapsed ? "block" : ""}`}
                style={{ color: "var(--sidebar-foreground)" }}
                title="Odhlásit se"
              >
                <LogOut className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Odhlásit se
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      </div>
    </aside>
    </>
  );
}
