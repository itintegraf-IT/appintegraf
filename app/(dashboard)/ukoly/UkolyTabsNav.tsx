"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, BarChart3, List, Plus, Users } from "lucide-react";

export function UkolyTabsNav({ canWrite }: { canWrite: boolean }) {
  const pathname = usePathname();
  const isList = pathname === "/ukoly";
  const isZadani = pathname === "/ukoly/zadani";
  const isNew = pathname === "/ukoly/new";
  const isStats = pathname === "/ukoly/stats";
  const isArchive = pathname === "/ukoly/archive";

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
    }`;

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-4">
      <Link href="/ukoly" className={tabClass(isList)}>
        <List className="h-4 w-4" />
        Moje úkoly
      </Link>
      {canWrite && (
        <Link href="/ukoly/zadani" className={tabClass(isZadani)}>
          <Users className="h-4 w-4" />
          Sledování zadání
        </Link>
      )}
      {canWrite && (
        <Link href="/ukoly/new" className={tabClass(isNew)}>
          <Plus className="h-4 w-4" />
          Nový úkol
        </Link>
      )}
      <Link href="/ukoly/archive" className={tabClass(isArchive)}>
        <Archive className="h-4 w-4" />
        Archiv
      </Link>
      <Link href="/ukoly/stats" className={tabClass(isStats)}>
        <BarChart3 className="h-4 w-4" />
        Statistiky
      </Link>
    </nav>
  );
}
