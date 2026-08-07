"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  HelpCircle,
  Upload,
  FileText,
  ClipboardList,
  Users,
  CalendarClock,
  BarChart3,
} from "lucide-react";

const TABS = [
  { href: "/training/manage", label: "Přehled", icon: LayoutDashboard, exact: true },
  { href: "/training/manage/questions", label: "Otázky", icon: HelpCircle },
  { href: "/training/manage/import", label: "Import CSV", icon: Upload },
  { href: "/training/manage/materials", label: "Materiály", icon: FileText },
  { href: "/training/manage/tests", label: "Testy", icon: ClipboardList },
  { href: "/training/manage/groups", label: "Skupiny", icon: Users },
  { href: "/training/manage/assignments", label: "Přiřazení", icon: CalendarClock },
  { href: "/training/manage/results", label: "Výsledky", icon: BarChart3 },
];

export function ManageNav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 overflow-x-auto">
      <nav className="flex min-w-max gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-red-600 text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
