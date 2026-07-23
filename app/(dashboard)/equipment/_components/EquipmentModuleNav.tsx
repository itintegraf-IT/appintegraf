"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardCheck,
  DoorOpen,
  Laptop,
  Map,
  QrCode,
  Settings,
  ArrowRightLeft,
  UserCheck,
} from "lucide-react";

type Props = {
  canAdmin?: boolean;
};

const MAIN_TABS = [
  { href: "/equipment", label: "Přehled", icon: Laptop, match: (p: string) => p === "/equipment" || /^\/equipment\/(add|\d+)/.test(p) },
  { href: "/equipment/prirazeni", label: "Přiřazení", icon: UserCheck, match: (p: string) => p.startsWith("/equipment/prirazeni") },
  { href: "/equipment/rooms", label: "Místnosti", icon: DoorOpen, match: (p: string) => p.startsWith("/equipment/rooms") },
  { href: "/equipment/plan", label: "Půdorys", icon: Map, match: (p: string) => p.startsWith("/equipment/plan") },
  { href: "/equipment/scan", label: "Skenovat", icon: QrCode, match: (p: string) => p.startsWith("/equipment/scan") },
  { href: "/equipment/presun", label: "Přesun", icon: ArrowRightLeft, match: (p: string) => p.startsWith("/equipment/presun") },
  { href: "/equipment/inventura", label: "Inventura", icon: ClipboardCheck, match: (p: string) => p.startsWith("/equipment/inventura") },
  { href: "/equipment/reporty", label: "Reporty", icon: BarChart3, match: (p: string) => p.startsWith("/equipment/reporty") },
] as const;

export function EquipmentModuleNav({ canAdmin = false }: Props) {
  const pathname = usePathname() ?? "";

  if (pathname.startsWith("/equipment/protokol")) {
    return null;
  }

  const settingsActive = pathname.startsWith("/equipment/settings");

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
    }`;

  return (
    <nav
      className="mb-6 flex flex-wrap items-center gap-2 border-b border-gray-200 pb-4"
      aria-label="Navigace modulu Majetek"
    >
      {MAIN_TABS.map(({ href, label, icon: Icon, match }) => (
        <Link key={href} href={href} className={tabClass(match(pathname))}>
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
      {canAdmin ? (
        <Link href="/equipment/settings" className={tabClass(settingsActive)}>
          <Settings className="h-4 w-4" />
          Nastavení
        </Link>
      ) : null}
    </nav>
  );
}
