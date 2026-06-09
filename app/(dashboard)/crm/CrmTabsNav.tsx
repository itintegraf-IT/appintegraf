"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  KanbanSquare,
  Clock,
  BellRing,
  Settings,
} from "lucide-react";

export function CrmTabsNav({ canAdmin }: { canAdmin: boolean }) {
  const pathname = usePathname();

  const tabs = [
    { href: "/crm", label: "Přehled", icon: LayoutDashboard, exact: true },
    { href: "/crm/companies", label: "Firmy", icon: Building2 },
    { href: "/crm/contacts", label: "Kontakty", icon: Users },
    { href: "/crm/deals", label: "Obchody", icon: Briefcase, exact: true },
    { href: "/crm/deals/kanban", label: "Pipeline", icon: KanbanSquare },
    { href: "/crm/activities", label: "Aktivity", icon: Clock },
    { href: "/crm/reminders", label: "Připomenutí", icon: BellRing },
  ];

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
    }`;

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-4">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link key={tab.href} href={tab.href} className={tabClass(active)}>
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
      {canAdmin && (
        <Link
          href="/crm/admin/deal-categories"
          className={tabClass(pathname.startsWith("/crm/settings") || pathname.startsWith("/crm/admin"))}
        >
          <Settings className="h-4 w-4" />
          Nastavení
        </Link>
      )}
    </nav>
  );
}
