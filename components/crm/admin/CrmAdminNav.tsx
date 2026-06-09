"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Tag, ScrollText, Shield, Plug } from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_TABS = [
  { href: "/crm/admin/deal-categories", label: "Kategorie dealů", icon: Layers },
  { href: "/crm/admin/lost-reasons", label: "Důvody prohry", icon: Tag },
  { href: "/crm/admin/audit", label: "Audit log", icon: ScrollText },
  { href: "/crm/admin/gdpr", label: "GDPR", icon: Shield },
  { href: "/crm/settings/integrations", label: "Integrace", icon: Plug },
] as const;

export function CrmAdminNav() {
  const pathname = usePathname();
  return (
    <nav
      className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-gray-200 pb-2"
      aria-label="CRM administrace"
    >
      {ADMIN_TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-red-50 font-medium text-red-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
